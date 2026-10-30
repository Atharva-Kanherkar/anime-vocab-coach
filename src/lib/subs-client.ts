/**
 * The English half of dual subtitles, when the page has no English line.
 *
 * Content side: one request per line, made the moment the line is known (a
 * cached transcript knows it seconds early), shared by everything that asks
 * for the same line, and remembered for rewinds. Background side: the call to
 * animevocab.com, which caches each line for every learner.
 */
import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";
import type { Token } from "../types";
import type { BatchRequest, BatchResponse } from "./episode-subs";

export interface SubTranslation {
  en: string;
  /** Token index → kana reading, for words the tokenizer may have misread. */
  readings: Record<string, string>;
}

export interface SubRequest {
  line: string;
  context: string[];
  title?: string | null;
  words: { i: number; s: string }[];
}

export type SubResponse = { ok: true; result: SubTranslation } | { ok: false; error: string };

const MAX_REMEMBERED = 400;
const KANJI = /[㐀-䶿一-鿿]/;

/** Words whose reading is worth checking: anything written with kanji. */
export function wordsToRead(tokens: Pick<Token, "surface">[]): { i: number; s: string }[] {
  const out: { i: number; s: string }[] = [];
  tokens.forEach((t, i) => {
    if (KANJI.test(t.surface) && t.surface.length <= 20 && out.length < 40) out.push({ i, s: t.surface });
  });
  return out;
}

/** Content-side memory of lines asked for, newest kept. */
export class SubTranslator {
  private lines = new Map<string, Promise<SubTranslation | null>>();
  private recent: string[] = [];
  /** Why the last request failed, so the caller can say so once. */
  lastError: string | null = null;

  constructor(private readonly send: (req: SubRequest) => Promise<SubResponse | undefined>) {}

  /** The translation of `line`, from memory or the network; null if there is none. */
  translate(line: string, tokens: Pick<Token, "surface">[], title: string | null): Promise<SubTranslation | null> {
    const hit = this.lines.get(line);
    if (hit) {
      // Refresh its place so a rewind keeps what was just watched.
      this.lines.delete(line);
      this.lines.set(line, hit);
      return hit;
    }
    const context = this.recent.slice(-3);
    this.recent = [...this.recent.filter((l) => l !== line), line].slice(-6);
    const pending = this.send({ line, context, title, words: wordsToRead(tokens) }).then(
      (res) => {
        if (res?.ok) { this.lastError = null; return res.result; }
        this.lastError = res?.error ?? "no_response";
        // A refusal for this account stays remembered; a blip may be retried.
        if (!/quota|not_linked|unauthorized/.test(this.lastError)) this.lines.delete(line);
        return null;
      },
      () => { this.lines.delete(line); this.lastError = "network"; return null; }
    );
    this.lines.set(line, pending);
    while (this.lines.size > MAX_REMEMBERED) this.lines.delete(this.lines.keys().next().value as string);
    return pending;
  }

  /** Already answered, without asking: for painting a line that is due now. */
  peek(line: string): Promise<SubTranslation | null> | undefined {
    return this.lines.get(line);
  }

  clear(): void {
    this.lines.clear();
    this.recent = [];
  }
}

/** Background side: the network call. */
export async function fetchSubTranslation(req: SubRequest): Promise<SubResponse> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ line: req.line, context: req.context, title: req.title || undefined, words: req.words }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: SubTranslation; error?: string };
    if (!res.ok || !data.result || typeof data.result.en !== "string") return { ok: false, error: data.error || `http_${res.status}` };
    const readings: Record<string, string> = {};
    if (data.result.readings && typeof data.result.readings === "object") {
      for (const [k, v] of Object.entries(data.result.readings)) {
        if (/^\d{1,3}$/.test(k) && typeof v === "string" && /^[ぁ-ゖァ-ヺー]{1,30}$/.test(v)) readings[k] = v;
      }
    }
    return { ok: true, result: { en: data.result.en.slice(0, 400), readings } };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Background side: a chunk of an episode's lines (see episode-subs). */
export async function fetchSubBatch(req: BatchRequest): Promise<BatchResponse> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/translate-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ title: req.title || undefined, lines: req.lines, context: req.context }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: { en?: unknown; names?: unknown }; error?: string };
    const en = data.result?.en;
    if (!res.ok || !Array.isArray(en) || en.length !== req.lines.length) return { ok: false, error: data.error || `http_${res.status}` };
    const names: Record<string, string> = {};
    if (data.result?.names && typeof data.result.names === "object") {
      for (const [k, v] of Object.entries(data.result.names as Record<string, unknown>)) {
        if (k.length <= 20 && typeof v === "string" && /^[\u3041-\u3096\u30a1-\u30faー]{1,30}$/.test(v)) names[k] = v;
      }
    }
    return { ok: true, result: { en: en.map((e) => (typeof e === "string" ? e.slice(0, 400) : "")), names } };
  } catch {
    return { ok: false, error: "network" };
  }
}
