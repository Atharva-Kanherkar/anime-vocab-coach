// The end-of-episode quiz API, called from the background worker: a content
// script's fetch is held to the page's CORS, and the worker holds the token.

import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";

export const EPISODE_QUIZ_MESSAGE = "avc-episode-quiz";

export interface EpisodeQuizResponse {
  ok: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export async function postEpisodeQuiz(payload: Record<string, unknown>): Promise<EpisodeQuizResponse> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/episode-quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, error: typeof data.error === "string" ? data.error : `http_${res.status}` };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "network" };
  }
}
