"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { CourseFailure } from "./common";

/** Object URLs for fetched clips. Clips are immutable, so a page session caches them. */
const urls = new Map<string, Promise<string>>();
let playing: HTMLAudioElement | null = null;

export async function loadAudio(path: string, signal?: AbortSignal): Promise<string> {
  let pending = urls.get(path);
  if (!pending) {
    pending = (async () => {
      const response = await fetch("/api/n5" + path, { credentials: "same-origin", signal });
      if (response.status === 401) window.dispatchEvent(new Event("avc-n5-auth-lost"));
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("audio/")) {
        const data = await response.json().catch(() => null);
        throw new CourseFailure(data?.error?.code ?? "audio_unavailable", response.status);
      }
      return URL.createObjectURL(await response.blob());
    })();
    urls.set(path, pending);
    // Failures are retried on the next press rather than cached.
    pending.catch(() => urls.delete(path));
  }
  return pending;
}

/** Play one clip, stopping anything else. Resolves when playback ends. */
export async function playAudio(path: string, rate = 1): Promise<void> {
  const url = await loadAudio(path);
  playing?.pause();
  const audio = new Audio(url);
  audio.playbackRate = rate;
  audio.preservesPitch = true;
  playing = audio;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new CourseFailure("audio_unavailable", 503));
    audio.play().catch(reject);
  });
}

export function stopAudio() {
  playing?.pause();
  playing = null;
}

/** Device speech for kana when server audio is unavailable. Never used in romaji mode. */
function speakKana(text: string, rate: number): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ja"));
  if (!voice) return false;
  const utterance = new SpeechSynthesisUtterance(text.replace(/ /g, ""));
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
  return true;
}

export function PlayButton({
  path,
  label,
  kana,
  compact = false,
  slow = true,
}: {
  path: string;
  /** Accessible description, e.g. the word being played. */
  label: string;
  /** Kana fallback text for device speech, only when the lesson script is kana. */
  kana?: string;
  compact?: boolean;
  slow?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  async function play(rate: number) {
    setState("loading");
    try {
      const done = playAudio(path, rate);
      if (mounted.current) setState("playing");
      await done;
      if (mounted.current) setState("idle");
    } catch {
      if (kana && speakKana(kana, rate < 1 ? 0.7 : 0.95)) {
        if (mounted.current) setState("idle");
        return;
      }
      if (mounted.current) setState("error");
    }
  }
  return (
    <span className={compact ? "n5-play n5-play-compact" : "n5-play"}>
      <button
        type="button"
        className="n5-icon-button"
        onClick={() => play(1)}
        aria-label={`Play ${label}`}
        data-state={state}
      >
        <Icon name={state === "loading" ? "loading" : state === "playing" ? "pause" : "play"} size={14} />
      </button>
      {slow && (
        <button
          type="button"
          className="n5-icon-button n5-slow"
          onClick={() => play(0.7)}
          aria-label={`Play ${label} slowly`}
        >
          <span aria-hidden>0.7×</span>
        </button>
      )}
      {state === "error" && (
        <span role="status" className="n5-muted n5-audio-error">
          Audio unavailable
        </span>
      )}
    </span>
  );
}
