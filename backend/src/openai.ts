// Mints a short-lived ephemeral client secret for the Realtime transcription
// API. The extension connects to wss://api.openai.com directly with this
// token (same WebSocket subprotocol trick it already uses for BYO keys), so
// audio bytes never touch our Worker and the real API key never leaves here.
//
// Docs: https://platform.openai.com/docs/api-reference/realtime-sessions
// (endpoint: POST /v1/realtime/client_secrets — verify the session shape
// against current docs before first deploy).

import type { Env } from "./index";

export interface EphemeralToken {
  value: string;
  expiresAt: number;
}

export async function mintTranscriptionToken(env: Env): Promise<EphemeralToken> {
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      // Token must be used to open the WS within 2 minutes; the session
      // itself then lives until closed (or OpenAI's ~60 min session limit,
      // after which the extension re-mints and reconnects).
      expires_after: { anchor: "created_at", seconds: 120 },
      session: {
        type: "transcription",
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 24000 },
            transcription: { model: env.TRANSCRIBE_MODEL, language: "ja" },
            turn_detection: { type: "server_vad", silence_duration_ms: 500 }
          }
        }
      }
    })
  });

  interface ClientSecretResponse {
    value?: string;
    expires_at?: number;
    error?: { message?: string };
  }
  const data = (await res.json().catch(() => ({}))) as ClientSecretResponse;
  if (!res.ok || !data.value) {
    throw new Error("OpenAI client_secrets failed: " + (data.error?.message || res.status));
  }
  return { value: data.value, expiresAt: data.expires_at || 0 };
}
