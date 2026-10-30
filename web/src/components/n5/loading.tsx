"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The course loader: a skeleton of the page that's coming, plus a one-octave
 * piano that plays "Twinkle Twinkle Little Star" (episode 12's title) in light
 * while you wait. Tapping a key plays a soft note; nothing makes sound without a
 * tap. Tips are English only, so no Japanese appears before the script is known.
 */
const WHITE = [
  { note: "C", hz: 261.63 }, { note: "D", hz: 293.66 }, { note: "E", hz: 329.63 }, { note: "F", hz: 349.23 },
  { note: "G", hz: 392.0 }, { note: "A", hz: 440.0 }, { note: "B", hz: 493.88 }, { note: "C", hz: 523.25 },
] as const;
/** Black keys sit after these white-key indices. */
const BLACK = [
  { after: 0, note: "C sharp", hz: 277.18 }, { after: 1, note: "D sharp", hz: 311.13 },
  { after: 3, note: "F sharp", hz: 369.99 }, { after: 4, note: "G sharp", hz: 415.3 }, { after: 5, note: "A sharp", hz: 466.16 },
] as const;
/** White-key indices for the melody; -1 is a rest. */
export const MELODY = [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 1, 1, 0, -1, -1] as const;
export const TIPS = [
  "Tap a word card to flip it, and press 0.7× to hear it slowly.",
  "Score 80% in Practice to pass a unit.",
  "Speak at least three replies aloud for speaking to count.",
  "Number keys 1 to 3 answer quiz questions.",
  "Each unit links to official services that stream the episode in your region.",
  "Stuck on a word in the quiz? The review explains every answer.",
] as const;

let audio: AudioContext | null = null;
function playTone(hz: number) {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    gain.connect(audio.destination);
    // A triangle fundamental plus a quiet octave reads as a soft, piano-like note.
    for (const [type, mult, level] of [["triangle", 1, 1], ["sine", 2, 0.25]] as const) {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type;
      osc.frequency.value = hz * mult;
      g.gain.value = level;
      osc.connect(g).connect(gain);
      osc.start(now);
      osc.stop(now + 1.35);
    }
  } catch {
    /* audio is decoration only */
  }
}

const REDUCED = "(prefers-reduced-motion: reduce)";
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia?.(REDUCED);
      query?.addEventListener?.("change", notify);
      return () => query?.removeEventListener?.("change", notify);
    },
    () => Boolean(window.matchMedia?.(REDUCED).matches),
    () => false,
  );
}

function Piano() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [withSound, setWithSound] = useState(false);
  const soundRef = useRef(false);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % MELODY.length), 380);
    return () => clearInterval(timer);
  }, [reduced]);
  const lit: number = reduced ? -1 : MELODY[step];
  useEffect(() => {
    // After "Play the melody", the light show sounds for one pass of the tune.
    const key = WHITE[lit];
    if (soundRef.current && key) playTone(key.hz);
  }, [step, lit]);
  const stop = useRef<number | null>(null);
  useEffect(() => () => { if (stop.current) window.clearTimeout(stop.current); }, []);
  const press = useCallback((id: string, hz: number) => {
    playTone(hz);
    setPressed(id);
    window.setTimeout(() => setPressed((p) => (p === id ? null : p)), 220);
  }, []);
  return (
    <div className="n5-piano-wrap">
      <div className="n5-piano" role="group" aria-label="Piano keys you can play while the page loads">
        {WHITE.map((k, i) => (
          <button
            key={`w${i}`}
            type="button"
            className="n5-key n5-key-white"
            data-lit={lit === i || pressed === `w${i}` || undefined}
            aria-label={`Play ${k.note}`}
            onPointerDown={() => press(`w${i}`, k.hz)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                press(`w${i}`, k.hz);
              }
            }}
          />
        ))}
        {BLACK.map((k) => (
          <button
            key={`b${k.after}`}
            type="button"
            className="n5-key n5-key-black"
            style={{ ["--n5-key" as string]: k.after }}
            data-lit={pressed === `b${k.after}` || undefined}
            aria-label={`Play ${k.note}`}
            onPointerDown={() => press(`b${k.after}`, k.hz)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                press(`b${k.after}`, k.hz);
              }
            }}
          />
        ))}
      </div>
      {!reduced && (
        <button
          type="button"
          className="n5-link n5-melody"
          aria-pressed={withSound}
          onClick={() => {
            soundRef.current = true;
            setWithSound(true);
            setStep(MELODY.length - 1);
            if (stop.current) window.clearTimeout(stop.current);
            stop.current = window.setTimeout(() => {
              soundRef.current = false;
              setWithSound(false);
            }, (MELODY.length - 2) * 380);
          }}
        >
          {withSound ? "Playing Twinkle Twinkle…" : "Play the melody"}
        </button>
      )}
    </div>
  );
}

function Tips() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), 3600);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="n5-loader-tip" key={index}>
      <span className="n5-eyebrow">Tip</span> {TIPS[index]}
    </p>
  );
}

function Skeleton({ variant }: { variant: "home" | "lesson" | "page" }) {
  if (variant === "home")
    return (
      <div className="n5-skel n5-skel-home" aria-hidden>
        <div className="n5-skel-hero">
          <span className="n5-bone n5-bone-dark" style={{ width: "28%" }} />
          <span className="n5-bone n5-bone-dark n5-bone-title" style={{ width: "62%" }} />
          <span className="n5-bone n5-bone-dark" style={{ width: "48%" }} />
        </div>
        <div className="n5-skel-grid">
          <div className="n5-skel-stack">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="n5-bone n5-bone-row" style={{ animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <span className="n5-bone n5-bone-card" />
        </div>
      </div>
    );
  return (
    <div className={`n5-skel n5-skel-${variant}`} aria-hidden>
      <div className="n5-skel-stack">
        <span className="n5-bone" style={{ width: "30%" }} />
        <span className="n5-bone n5-bone-title" style={{ width: "55%" }} />
        <span className="n5-bone n5-bone-tabs" />
        <span className="n5-bone n5-bone-panel" />
      </div>
      {variant === "lesson" && (
        <div className="n5-skel-side">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="n5-bone" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CourseLoading({ variant = "page", label = "Loading your practice…" }: { variant?: "home" | "lesson" | "page"; label?: string }) {
  return (
    <div className="n5-loading" data-variant={variant}>
      <Skeleton variant={variant} />
      <div className="n5-loader">
        <p role="status" className="n5-loader-title">
          {label}
        </p>
        <Piano />
        <Tips />
      </div>
    </div>
  );
}
