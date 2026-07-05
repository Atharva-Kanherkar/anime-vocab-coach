// AI coach client — runs in the BACKGROUND service worker. Content scripts
// can't fetch the hosted API cross-origin (MV3 CORS), but the SW can (host
// permission), so the overlay messages the background and the background calls
// this. Uses the sync token the web app handed us; no token → not linked.
import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";

export type CoachMode = "explain" | "hooks";

export interface CoachPayload {
  word: string;
  reading?: string;
  gloss?: string;
  line: string;
  level?: number | null;
  title?: string | null;
}

export interface CoachResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export async function fetchCoach(mode: CoachMode, payload: CoachPayload): Promise<CoachResponse> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ mode, ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
    return { ok: true, result: data.result };
  } catch {
    return { ok: false, error: "network" };
  }
}
