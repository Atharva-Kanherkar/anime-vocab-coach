import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";
import type { LearningDirection } from "./direction";

export interface WordPickCandidate {
  word: string;
  reading: string;
  gloss: string;
  level: number;
  essential?: boolean;
}

export interface WordPickRequest {
  line: string;
  candidates: WordPickCandidate[];
  learnerLevel: number;
  wordsKnown?: number;
  title?: string | null;
  animeContext?: string | null;
  direction?: LearningDirection;
}

export interface WordPickResponse {
  ok: boolean;
  word?: string;
  cached?: boolean;
  error?: string;
}

const sessionCache = new Map<string, string>();

function sessionKey(req: WordPickRequest): string {
  const bases = req.candidates
    .map((c) => c.word)
    .sort()
    .join("|");
  return `${req.direction || "en-ja"}:${req.learnerLevel}:${req.line}:${bases}`;
}

/**
 * Content-side entry. A content script's fetch is bound by the *page's* CORS,
 * and the web API sends no Access-Control-Allow-Origin, so calling
 * fetchWordPick() from a YouTube/Netflix tab always failed its preflight and
 * fell through to the offline heuristic — silently, because the caller treats
 * any error as "just use the heuristic". Route it through the background
 * worker, which fetches with the extension origin + host permission.
 * (Mirrors requestAnimeContext in anime-context-client.ts.)
 */
export async function requestWordPick(req: WordPickRequest): Promise<WordPickResponse> {
  const key = sessionKey(req);
  const hit = sessionCache.get(key);
  if (hit) return { ok: true, word: hit, cached: true };
  try {
    const res = (await chrome.runtime.sendMessage({
      type: "avc-pick-word",
      payload: req,
    })) as WordPickResponse | undefined;
    if (!res) return { ok: false, error: "no_response" };
    if (res.ok && res.word) sessionCache.set(key, res.word);
    return res;
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Background-side: the real network call. */
export async function fetchWordPick(req: WordPickRequest): Promise<WordPickResponse> {
  const key = sessionKey(req);
  const hit = sessionCache.get(key);
  if (hit) return { ok: true, word: hit, cached: true };

  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };

  try {
    const res = await fetch(WEB_URL + "/api/ai/pick-word", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(req),
    });
    const data = (await res.json().catch(() => ({}))) as {
      result?: { word?: string };
      error?: string;
      cached?: boolean;
    };
    if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
    const word = data.result?.word;
    if (!word) return { ok: false, error: "empty_pick" };
    sessionCache.set(key, word);
    return { ok: true, word, cached: data.cached };
  } catch {
    return { ok: false, error: "network" };
  }
}
