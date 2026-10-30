/**
 * Turn-taking for the speaking call: decides from microphone loudness when the
 * learner has started talking and when they've finished, so replies send
 * themselves like a phone call. Pure, so the rules are testable without audio.
 */
export const VAD = {
  /** Loudness must stay above the threshold this long to count as speech. */
  speechMs: 180,
  /** After speech, this much quiet ends the turn. */
  silenceMs: 1100,
  /** Give up listening if nothing is said for this long. */
  idleMs: 12_000,
  /** Lowest loudness ever treated as speech (RMS, 0 to 1). */
  minLevel: 0.012,
  /** Speech must be this many times louder than the room. */
  ratio: 2.6,
} as const;

export interface VadState {
  /** Running estimate of background loudness. */
  floor: number;
  startedAt: number;
  heard: boolean;
  aboveSince: number | null;
  belowSince: number | null;
}
export type VadEvent = "none" | "speech" | "end" | "idle";

export function vadStart(now: number): VadState {
  return { floor: VAD.minLevel / VAD.ratio, startedAt: now, heard: false, aboveSince: null, belowSince: null };
}

export function vadThreshold(state: VadState): number {
  return Math.max(VAD.minLevel, state.floor * VAD.ratio);
}

export function vadStep(state: VadState, level: number, now: number): { state: VadState; event: VadEvent } {
  if (level >= vadThreshold(state)) {
    const aboveSince = state.aboveSince ?? now;
    if (!state.heard && now - aboveSince >= VAD.speechMs) return { state: { ...state, heard: true, aboveSince, belowSince: null }, event: "speech" };
    return { state: { ...state, aboveSince, belowSince: null }, event: "none" };
  }
  const belowSince = state.belowSince ?? now;
  // Only quiet before the first words teaches us what the room sounds like.
  const floor = state.heard ? state.floor : state.floor * 0.9 + level * 0.1;
  const next = { ...state, floor, aboveSince: null, belowSince };
  if (state.heard) return { state: next, event: now - belowSince >= VAD.silenceMs ? "end" : "none" };
  return { state: next, event: now - state.startedAt >= VAD.idleMs ? "idle" : "none" };
}

/** Root-mean-square loudness of one frame of samples in [-1, 1]. */
export function rms(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** mm:ss for the call timer. */
export function callClock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
