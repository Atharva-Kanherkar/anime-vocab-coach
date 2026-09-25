// Subtitle cues shaped like sentences.
//
// YouTube's auto-generated (ASR) tracks are not subtitles. Their json3 events
// are rolling windows of a few words each, timed per word, and a window cuts
// straight across sentences. Mirrored as they come, the Lens showed half a
// sentence, then the other half glued to the next one, never lined up with
// what was being said. Here the words are laid back out on the timeline and
// regrouped at sentence ends, pauses, and a readable length.
import { normalize } from "./adapters/util";

export interface TimedWord {
  start: number;
  text: string;
}

export interface SentenceCue {
  start: number;
  end: number;
  text: string;
}

interface Json3Seg {
  utf8?: string;
  tOffsetMs?: number;
}

interface Json3Event {
  tStartMs?: number;
  dDurMs?: number;
  aAppend?: number;
  segs?: Json3Seg[];
}

/** A pause this long between words ends the cue: the speaker stopped. */
export const GAP_SEC = 0.8;
/** Longest cue, in characters. Past this a subtitle stops being glanceable. */
export const MAX_CUE_CHARS = { ja: 28, en: 90 } as const;
/** How long a cue stays up after its last word starts, when nothing follows. */
const TAIL_SEC = 0.9;
const SENTENCE_END = /[。！？!?.…]["」』）)]*$/;

/** Every word on the track with its own start time, in order. */
export function parseJson3Words(data: { events?: Json3Event[] }): TimedWord[] {
  const words: TimedWord[] = [];
  for (const ev of data.events || []) {
    // Append events only carry the "\n" that scrolls the caption window.
    if (!ev.segs || ev.aAppend) continue;
    const base = (ev.tStartMs || 0) / 1000;
    for (const seg of ev.segs) {
      const text = seg.utf8 || "";
      if (!text.trim()) continue;
      words.push({ start: base + (seg.tOffsetMs || 0) / 1000, text: text.replace(/\n/g, " ") });
    }
  }
  words.sort((a, b) => a.start - b.start);
  return words;
}

/** Rough speaking time for a word, so a pause can be told from a long word. */
function spokenSec(text: string, lang: "ja" | "en"): number {
  const chars = text.trim().length;
  return Math.min(1.5, Math.max(0.2, chars * (lang === "ja" ? 0.13 : 0.06)));
}

/** Words regrouped into non-overlapping, sentence-sized cues. */
export function buildSentenceCues(words: TimedWord[], lang: "ja" | "en"): SentenceCue[] {
  const cap = MAX_CUE_CHARS[lang];
  const groups: TimedWord[][] = [];
  let current: TimedWord[] = [];
  let length = 0;

  const close = (): void => {
    if (current.length) groups.push(current);
    current = [];
    length = 0;
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLength = word.text.trim().length;
    if (current.length && length + wordLength > cap) close();
    current.push(word);
    length += wordLength;
    const next = words[i + 1];
    if (!next) break;
    const gap = next.start - (word.start + spokenSec(word.text, lang));
    if (SENTENCE_END.test(word.text.trim()) || gap >= GAP_SEC) close();
  }
  close();

  const cues: SentenceCue[] = [];
  groups.forEach((group, i) => {
    const text = normalize(group.map((w) => w.text.trim()).join(lang === "ja" ? "" : " "));
    if (!text) return;
    const last = group[group.length - 1];
    const start = group[0].start;
    const nextStart = groups[i + 1]?.[0].start ?? Infinity;
    const end = Math.min(nextStart, last.start + spokenSec(last.text, lang) + TAIL_SEC);
    cues.push({ start, end: Math.max(end, start + 0.1), text });
  });
  return cues;
}

/**
 * A caption node that rolls, word by word (YouTube's ASR captions drawn on the
 * page), turned into settled lines.
 *
 * Each appended word used to count as a new line, so the Lens re-rendered a
 * growing fragment several times a second and every prefix went to the card
 * pipeline. A line now counts once the text has held still for `settleMs` (or
 * has kept rolling for `maxHoldMs`), and only when it adds words that were not
 * in the last line given out.
 */
export class RollingCaption {
  private pending = "";
  private changedAt = 0;
  private rollingSince = 0;
  private emitted = "";

  constructor(private readonly settleMs = 700, private readonly maxHoldMs = 4000) {}

  /** Feed what is on screen now. */
  update(text: string, now: number): void {
    if (text === this.pending) return;
    if (!this.pending) this.rollingSince = now;
    this.pending = text;
    this.changedAt = now;
  }

  /** The caption to emit now, if it has settled (or rolled too long) and says
   * something new. `force` takes it regardless: the caption left the screen. */
  take(now: number, force = false): string | null {
    if (!this.pending) return null;
    const settled = force || now - this.changedAt >= this.settleMs;
    if (!settled && now - this.rollingSince < this.maxHoldMs) return null;
    const line = this.pending;
    const fresh = unseenTail(this.emitted, line);
    this.rollingSince = now;
    if (settled) this.pending = "";
    if (!fresh) return null;
    this.emitted = line;
    return line;
  }

  /** A caption that replaced the last one outright: it is out, nothing waits. */
  markEmitted(text: string): void {
    this.pending = "";
    this.emitted = text;
  }

  /** Whether `text` continues the caption given out last (a rolling update)
   * rather than replacing it. */
  continues(text: string): boolean {
    const prev = this.pending || this.emitted;
    return !!prev && unseenTail(prev, text) !== text.trim();
  }

  reset(): void {
    this.pending = "";
    this.emitted = "";
  }
}

/** Shortest overlap trusted as rolled-over text rather than a coincidence. */
const MIN_OVERLAP = 2;

/** The part of `next` that `prev` did not already cover: drops the longest
 * suffix of `prev` that `next` starts with (the words that rolled over). */
export function unseenTail(prev: string, next: string): string {
  if (!prev) return next.trim();
  if (next.startsWith(prev)) return next.slice(prev.length).trim();
  for (let k = Math.min(prev.length, next.length); k >= MIN_OVERLAP; k--) {
    if (next.startsWith(prev.slice(prev.length - k))) return next.slice(k).trim();
  }
  return next.trim();
}
