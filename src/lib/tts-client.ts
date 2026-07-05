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

export async function speakText(text: string): Promise<TtsResult> {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: false, error: "empty" };

  try {
    const settings = await getSettings();
    if (settings.openaiKey?.trim()) {
      const blob = await fetchByoTts(trimmed, settings.openaiKey.trim());
      if (blob) {
        await playBlob(blob);
        return { ok: true };
      }
    }

    const token = await getSyncToken();
    if (token) {
      const blob = await fetchCloudTts(trimmed, token);
      if (blob) {
        await playBlob(blob);
        return { ok: true };
      }
    }

    return { ok: false, error: "not_linked" };
  } catch {
    return { ok: false, error: "playback_failed" };
  }
}
