import { BACKEND_URL } from "../config";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface LookupResponse {
  hit: boolean;
  segments: TranscriptSegment[];
  source?: "whisper";
  stale?: boolean;
}

export async function lookupTranscript(
  syncToken: string,
  cacheKey: string,
  t: number,
  windowSec = 8
): Promise<LookupResponse> {
  const url = new URL(BACKEND_URL + "/v1/transcript");
  url.searchParams.set("key", cacheKey);
  url.searchParams.set("t", String(t));
  url.searchParams.set("window", String(windowSec));
  const res = await fetch(url.toString(), {
    headers: { Authorization: "Bearer " + syncToken }
  });
  if (res.status === 401) throw new Error("not signed in");
  if (res.status === 429) throw new Error("monthly listening hours used up");
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || "transcript lookup HTTP " + res.status);
  }
  return res.json() as Promise<LookupResponse>;
}

export async function transcribeChunk(
  syncToken: string,
  cacheKey: string,
  startSec: number,
  audioBase64: string
): Promise<LookupResponse> {
  const res = await fetch(BACKEND_URL + "/v1/transcript/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + syncToken
    },
    body: JSON.stringify({ key: cacheKey, startSec, audio: audioBase64 })
  });
  const data = (await res.json().catch(() => ({}))) as LookupResponse & { error?: string };
  if (res.status === 401) throw new Error("not signed in");
  if (res.status === 429) throw new Error(data.error || "monthly listening hours used up");
  if (!res.ok) throw new Error(data.error || "transcribe HTTP " + res.status);
  return data;
}
