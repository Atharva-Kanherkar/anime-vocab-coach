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
  animeContext?: string | null;
  learnerLevel?: number | null;
  wordsKnown?: number | null;
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

export async function streamChat(
  message: string,
  history: ChatMessage[],
  payload: CoachPayload,
  onChunk: (delta: string) => void
): Promise<{ ok: boolean; error?: string }> {
  const token = await getSyncToken();
  if (!token) return { ok: false, error: "not_linked" };
  try {
    const res = await fetch(WEB_URL + "/api/ai/coach/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ mode: "chat", message, history, ...payload }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || `http_${res.status}` };
    }
    if (!res.body) return { ok: false, error: "no_body" };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        try {
          const json = JSON.parse(line.slice(6)) as { delta?: string; error?: string; done?: boolean };
          if (json.error) return { ok: false, error: json.error };
          if (typeof json.delta === "string") onChunk(json.delta);
        } catch {
          /* skip */
        }
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
