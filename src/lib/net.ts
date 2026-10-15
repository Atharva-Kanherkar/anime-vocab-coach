// Ceilings for every network call the extension makes (ISO 25010 reliability
// audit). fetch() has no timeout of its own: a stalled server or a captive
// portal left cards, the coach and Listening Mode waiting forever, with the UI
// stuck on a spinner. An abort surfaces as a normal failure the caller already
// handles.
export const TIMEOUT_MS = {
  /** Small JSON round trips: sync, usage, beacons, captions. */
  quick: 15_000,
  /** A model call behind our API (word pick, coach, extraction, TTS). */
  ai: 45_000,
  /** An audio chunk upload that the server transcribes before answering. */
  upload: 30_000,
} as const;

export function timeout(kind: keyof typeof TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(TIMEOUT_MS[kind]);
}
