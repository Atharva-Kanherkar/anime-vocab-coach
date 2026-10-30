/**
 * Dual subtitles for a whole episode, known before it plays.
 *
 * Built from the player's own Japanese track. The English comes from the
 * player's English track when the region has one (official, same timing), or
 * is translated a chunk at a time ahead of playback: the chunk playing now
 * first, then the ones after it, a few at once. Either way a line's English
 * is normally waiting before the line appears, so nothing is translated while
 * the learner watches.
 */
import { chunkOrder, englishFor, type TimedCue } from "./netflix-tracks";

/** Lines per translation request. Cut at fixed places in the track, so
 * every learner watching the episode shares the same cached chunks. */
export const CHUNK = 20;
/** Chunks in flight at once. */
export const PARALLEL = 4;

export interface BatchRequest {
  title?: string | null;
  lines: string[];
  context: string[];
}
export type BatchResponse =
  | { ok: true; result: { en: string[]; names: Record<string, string> } }
  | { ok: false; error: string };

type ChunkState = "idle" | "loading" | "done" | "failed";

export class EpisodeSubs {
  readonly source: "track" | "translation";
  /** Furigana and names: as written → reading. */
  readonly glossary = new Map<string, string>();
  /** null: not known yet. "": nothing to show. */
  private english: (string | null)[];
  private chunks: ChunkState[];
  private queue: number[] = [];
  private running = 0;
  private waiters = new Map<number, ((en: string | null) => void)[]>();
  private stopped = false;
  lastError: string | null = null;

  constructor(
    readonly cues: TimedCue[],
    englishTrack: TimedCue[] | null,
    private readonly title: string | null,
    private readonly send: (req: BatchRequest) => Promise<BatchResponse | undefined>
  ) {
    for (const cue of cues) for (const [written, reading] of cue.ruby) this.glossary.set(written, reading);
    if (englishTrack && englishTrack.length) {
      this.source = "track";
      this.english = englishFor(cues, englishTrack);
      this.chunks = [];
    } else {
      this.source = "translation";
      this.english = cues.map(() => null);
      this.chunks = Array.from({ length: Math.ceil(cues.length / CHUNK) }, () => "idle" as ChunkState);
    }
  }

  /** The English for cue `i` if it is known now. */
  englishAt(i: number): string | null {
    return this.english[i] ?? null;
  }

  /** The English for cue `i` once it is known; null if it could not be had. */
  whenEnglish(i: number): Promise<string | null> {
    const now = this.english[i];
    if (now !== null && now !== undefined) return Promise.resolve(now);
    if (this.source === "track" || this.chunks[Math.floor(i / CHUNK)] === "failed" || this.stopped) return Promise.resolve(null);
    return new Promise((resolve) => {
      const list = this.waiters.get(i) ?? [];
      list.push(resolve);
      this.waiters.set(i, list);
      this.translateFrom(i);
    });
  }

  /** Translate from cue `i` onwards (then what came before). Cheap to call
   * on every cue: it only reorders what is still waiting. */
  translateFrom(i: number): void {
    if (this.source === "track" || this.stopped) return;
    const order = chunkOrder(this.chunks.length, Math.floor(Math.max(i, 0) / CHUNK));
    this.queue = order.filter((c) => this.chunks[c] === "idle");
    while (this.running < PARALLEL && this.queue.length) this.runNext();
  }

  /** Chunks translated so far, of all. */
  progress(): { done: number; total: number } {
    return { done: this.chunks.filter((c) => c === "done").length, total: this.chunks.length };
  }

  /** Stop asking (another video, or the account is out of lines). */
  stop(): void {
    this.stopped = true;
    this.queue = [];
    for (const [i, list] of this.waiters) for (const resolve of list) resolve(this.english[i] ?? null);
    this.waiters.clear();
  }

  private runNext(): void {
    const chunk = this.queue.shift();
    if (chunk === undefined || this.chunks[chunk] !== "idle") return;
    this.chunks[chunk] = "loading";
    this.running++;
    const from = chunk * CHUNK;
    const lines = this.cues.slice(from, from + CHUNK).map((c) => c.text);
    const context = this.cues.slice(Math.max(0, from - 3), from).map((c) => c.text);
    this.send({ title: this.title, lines, context })
      .then((res) => {
        if (res?.ok && res.result.en.length === lines.length) {
          this.chunks[chunk] = "done";
          res.result.en.forEach((en, k) => this.settle(from + k, en));
          for (const [written, reading] of Object.entries(res.result.names)) {
            if (!this.glossary.has(written)) this.glossary.set(written, reading);
          }
        } else {
          this.fail(chunk, res && !res.ok ? res.error : "no_response");
        }
      }, () => this.fail(chunk, "network"))
      .finally(() => {
        this.running--;
        if (!this.stopped) while (this.running < PARALLEL && this.queue.length) this.runNext();
      });
  }

  private settle(i: number, en: string): void {
    this.english[i] = en;
    const list = this.waiters.get(i);
    if (!list) return;
    this.waiters.delete(i);
    for (const resolve of list) resolve(en);
  }

  private fail(chunk: number, error: string): void {
    this.chunks[chunk] = "failed";
    this.lastError = error;
    // An account out of lines, or signed out, will not do better on the next chunk.
    if (/quota|not_linked|unauthorized/.test(error)) this.stop();
    const from = chunk * CHUNK;
    for (let i = from; i < from + CHUNK; i++) {
      const list = this.waiters.get(i);
      if (!list) continue;
      this.waiters.delete(i);
      for (const resolve of list) resolve(null);
    }
  }
}

/**
 * Readings for a line's tokens from the glossary: a name written across
 * several tokens (公 + 生) reads as one (こうせい). The first token takes the
 * reading and the rest read as nothing, so the name shows as one word.
 */
export function glossaryReadings(tokens: { surface: string }[], glossary: Map<string, string>): Record<string, string> {
  const readings: Record<string, string> = {};
  if (!glossary.size) return readings;
  for (let i = 0; i < tokens.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(tokens.length, i + 4); j++) {
      joined += tokens[j].surface;
      const reading = glossary.get(joined);
      if (reading && /[㐀-鿿]/.test(joined)) {
        readings[String(i)] = reading;
        for (let k = i + 1; k <= j; k++) readings[String(k)] = "";
        i = j;
        break;
      }
      if (joined.length > 12) break;
    }
  }
  return readings;
}
