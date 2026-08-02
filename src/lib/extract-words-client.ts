import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";
import type { LearningDirection } from "./direction";
import type { DictEntry } from "../types";

export interface ExtractedWord {
  word: string;
  reading: string;
  gloss: string;
  level: number;
}

export interface ExtractWordsResponse {
  ok: boolean;
  words?: ExtractedWord[];
  cached?: boolean;
  error?: string;
}

const sessionCache = new Map<string, ExtractedWord[]>();

function sessionKey(line: string, direction: LearningDirection, level: number): string {
  return `${direction}:${level}:${line}`;
}

export interface ExtractWordsRequest {
  line: string;
  direction: LearningDirection;
  learnerLevel: number;
  title?: string | null;
}

/**
 * Content-side entry. Same CORS constraint as word picking and anime context:
 * the web API sends no Access-Control-Allow-Origin, so a direct fetch from a
 * streaming tab fails its preflight and the ja→en glossing that depends on it
 * quietly produces nothing. Hand the request to the background worker instead.
 */
export async function requestExtractWords(opts: ExtractWordsRequest): Promise<ExtractWordsResponse> {
  const key = sessionKey(opts.line, opts.direction, opts.learnerLevel);
  const hit = sessionCache.get(key);
  if (hit) return { ok: true, words: hit, cached: true };
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "avc-extract-words",
      payload: opts,
    })) as ExtractWordsResponse | undefined;
    if (!res) return { ok: false, error: "no_response" };
    if (res.ok && res.words?.length) sessionCache.set(key, res.words);
    return res;
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Background-side: the real network call. */
export async function fetchExtractWords(opts: {
  line: string;
  direction: LearningDirection;
  learnerLevel: number;
  title?: string | null;
}): Promise<ExtractWordsResponse> {
  const key = sessionKey(opts.line, opts.direction, opts.learnerLevel);
  const hit = sessionCache.get(key);
  if (hit) return { ok: true, words: hit, cached: true };

  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };

  try {
    const res = await fetch(WEB_URL + "/api/ai/extract-words", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        line: opts.line,
        direction: opts.direction,
        learnerLevel: opts.learnerLevel,
        title: opts.title || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      result?: { words?: ExtractedWord[] };
      error?: string;
      cached?: boolean;
    };
    if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
    const words = data.result?.words;
    if (!words?.length) return { ok: false, error: "empty_extract" };
    sessionCache.set(key, words);
    return { ok: true, words, cached: data.cached };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Build a per-line dict overlay from AI (and local essentials already in scoring). */
export function overlayFromExtract(words: ExtractedWord[]): Record<string, DictEntry> {
  const overlay: Record<string, DictEntry> = {};
  for (const w of words) {
    const base = w.word.trim().toLowerCase();
    if (!base) continue;
    overlay[base] = {
      reading: w.reading || "",
      glosses: w.gloss ? [w.gloss] : [],
      level: w.level,
      freqRank: Math.round((6 - w.level) * 2000),
    };
    // Also key by surface casing the model returned.
    if (w.word !== base) {
      overlay[w.word] = overlay[base]!;
    }
  }
  return overlay;
}
