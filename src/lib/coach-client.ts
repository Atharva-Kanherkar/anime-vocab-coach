import { WEB_URL } from "../config";
import { getSyncToken } from "./storage";

export type CoachMode = "explain" | "hooks" | "chat";

export interface CoachPayload {
  word: string;
  reading?: string;
  gloss?: string;
  line: string;
  level?: number | null;
  title?: string | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

async function postCoach(body: Record<string, unknown>): Promise<CoachResponse> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: data.error || `http_${res.status}` };
    return { ok: true, result: data.result };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchCoach(mode: Exclude<CoachMode, "chat">, payload: CoachPayload): Promise<CoachResponse> {
  return postCoach({ mode, ...payload });
}

export async function fetchChat(
  message: string,
  history: ChatMessage[],
  payload: CoachPayload
): Promise<CoachResponse> {
  return postCoach({ mode: "chat", message, history, ...payload });
}
