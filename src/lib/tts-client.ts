import { WEB_URL } from "../config";
import { getSettings, getSyncToken } from "./storage";

export interface TtsResult {
  ok: boolean;
  error?: string;
}

let activeAudio: HTMLAudioElement | null = null;

async function playBlob(blob: Blob): Promise<void> {
  if (activeAudio) {
    activeAudio.pause();
    URL.revokeObjectURL(activeAudio.src);
    activeAudio = null;
  }
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  activeAudio = audio;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    if (activeAudio === audio) activeAudio = null;
  };
  await audio.play();
}

async function fetchCloudTts(text: string, token: string): Promise<Blob | null> {
  const res = await fetch(WEB_URL + "/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.blob();
}

async function fetchByoTts(text: string, key: string): Promise<Blob | null> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model: "tts-1", voice: "nova", input: text, response_format: "mp3" }),
  });
  if (!res.ok) return null;
  return res.blob();
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

// Background-side: perform the actual TTS fetch (BYO key first, else cloud) and
// return base64 audio. Content scripts can't reach these APIs cross-origin, so
// this runs in the background service worker; playback stays in the page.
export async function fetchTtsAudio(text: string): Promise<{ b64: string; mime: string } | null> {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const settings = await getSettings();
  if (settings.openaiKey?.trim()) {
    const blob = await fetchByoTts(trimmed, settings.openaiKey.trim());
    if (blob) return { b64: await blobToBase64(blob), mime: blob.type || "audio/mpeg" };
  }

  const token = await getSyncToken();
  if (token) {
    const blob = await fetchCloudTts(trimmed, token);
    if (blob) return { b64: await blobToBase64(blob), mime: blob.type || "audio/mpeg" };
  }

  return null;
}

// Content-side: ask the background worker to fetch audio, then play it in-page.
export async function speakText(text: string): Promise<TtsResult> {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "empty" };

  try {
    const res = (await chrome.runtime.sendMessage({ type: "avc-tts", text: trimmed })) as
      | { ok?: boolean; b64?: string; mime?: string; error?: string }
      | undefined;
    if (res?.ok && res.b64) {
      await playBlob(base64ToBlob(res.b64, res.mime || "audio/mpeg"));
      return { ok: true };
    }
    return { ok: false, error: res?.error || "not_linked" };
  } catch {
    return { ok: false, error: "playback_failed" };
  }
}
