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
