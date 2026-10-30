/** Microphone turn state for the speaking tutor. The component owns MediaRecorder; this owns the rules. */
export type RecorderState =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "recording"; startedAt: number }
  | { phase: "sending" }
  | { phase: "error"; reason: "denied" | "unsupported" | "too_short" | "failed" };
export type RecorderAction =
  | { type: "request" }
  | { type: "granted"; at: number }
  | { type: "denied" }
  | { type: "unsupported" }
  | { type: "stop"; at: number }
  | { type: "sent" }
  | { type: "failed" }
  | { type: "reset" }
  /** Listening ended with nothing said: drop the recording without sending. */
  | { type: "cancel" };

export const MAX_RECORDING_MS = 30_000;
export const MIN_RECORDING_MS = 600;

export function recorderTransition(state: RecorderState, action: RecorderAction): RecorderState {
  switch (action.type) {
    case "request": return state.phase === "idle" || state.phase === "error" ? { phase: "requesting" } : state;
    case "granted": return state.phase === "requesting" ? { phase: "recording", startedAt: action.at } : state;
    case "denied": return state.phase === "requesting" ? { phase: "error", reason: "denied" } : state;
    case "unsupported": return { phase: "error", reason: "unsupported" };
    case "stop":
      if (state.phase !== "recording") return state;
      return action.at - state.startedAt < MIN_RECORDING_MS ? { phase: "error", reason: "too_short" } : { phase: "sending" };
    case "sent": return state.phase === "sending" ? { phase: "idle" } : state;
    case "failed": return state.phase === "sending" ? { phase: "error", reason: "failed" } : state;
    case "reset": return state.phase === "recording" || state.phase === "sending" ? state : { phase: "idle" };
    case "cancel": return state.phase === "recording" ? { phase: "idle" } : state;
  }
}

/** Seconds left before the automatic stop. */
export function remaining(state: RecorderState, now: number): number {
  return state.phase === "recording" ? Math.max(0, Math.ceil((MAX_RECORDING_MS - (now - state.startedAt)) / 1000)) : MAX_RECORDING_MS / 1000;
}

/** The base MIME type the API accepts, from what the browser recorded. */
export function recordingType(mime: string): "audio/webm" | "audio/ogg" | "audio/mp4" | "audio/wav" | null {
  const base = mime.split(";")[0].trim().toLowerCase();
  return base === "audio/webm" || base === "audio/ogg" || base === "audio/mp4" || base === "audio/wav" ? base : null;
}
