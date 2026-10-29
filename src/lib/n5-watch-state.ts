/**
 * Playback-derived watch signals for the N5 course.
 *
 * Watching is a timestamped observation and never assessment credit. Only an
 * explicit completion may produce a "watched" observation; skips, seeks and
 * replays are recorded as their own kinds and never unlock mastery. The
 * authoritative credit still comes from the backend's server-verified
 * assessment evidence; this module only classifies what playback did.
 */

export type N5WatchKind = "none" | "complete" | "skip" | "seek" | "replay";

export interface N5WatchSignal {
  finished: boolean;
  skipped?: boolean;
  seeked?: boolean;
  replayed?: boolean;
}

export function classifyN5WatchSignal(signal: N5WatchSignal): N5WatchKind {
  if (signal.finished) return "complete";
  if (signal.skipped) return "skip";
  if (signal.seeked) return "seek";
  if (signal.replayed) return "replay";
  return "none";
}

export interface N5WatchObservation {
  episodeId: string;
  kind: Exclude<N5WatchKind, "none">;
  observedAt: number;
}

/** Build the durable observation envelope for a classified playback action.
 * `kind` is already restricted to observation kinds; callers add the stable
 * event identity and reconcile through the backend. */
export function n5WatchObservation(
  signal: N5WatchSignal,
  episodeId: string,
  observedAt: number
): N5WatchObservation | null {
  const kind = classifyN5WatchSignal(signal);
  if (kind === "none") return null;
  return { episodeId, kind, observedAt };
}
