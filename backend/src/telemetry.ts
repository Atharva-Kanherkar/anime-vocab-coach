// Write path for Listening Mode transcription observability.
//
// Until this existed, transcription was the only paid unit in the product with
// no observability at all: it runs in this Worker, which had no Analytics
// Engine dataset, and its usage was visible only as a running total in a KV
// key (`use:<userId>:<month>`). The /owner dashboard reads avc_llm, so the
// most expensive thing the product sells was also the one thing the dashboard
// could not see.
//
// Two rules inherited from the web Worker's telemetry (see
// web/src/lib/telemetry.ts):
//   1. Never throw into the request path. A metering or observability failure
//      must not turn a successful transcription into an error.
//   2. Blob positions are load-bearing and append-only (telemetry-schema.ts).

import type { Env } from "./index";
import {
  TRANSCRIBE_BLOBS,
  TRANSCRIBE_DOUBLES,
  type TranscribeOutcome,
} from "./telemetry-schema";

/** Cloudflare's AE binding surface, narrowed to what we use. */
export interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: (string | null)[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

export interface TranscribeTelemetry {
  outcome: TranscribeOutcome;
  provider?: string | null;
  model?: string | null;
  userId?: string | null;
  plan?: string | null;
  language?: string | null;
  country?: string | null;
  errorCode?: string | null;
  fallbackUsed?: boolean;
  /** Real audio duration of the chunk, in minutes. */
  audioMinutes?: number;
  costUsd?: number;
  latencyMs?: number;
  segments?: number;
  /** The user's running monthly total after this call, for cap-headroom views. */
  monthMinutesAfter?: number;
}

/** AE rejects non-finite doubles, and one bad value drops the whole row. */
function finite(n: number | undefined): number {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** AE caps blob length; a long provider error must not drop the data point. */
function blob(v: string | null | undefined): string {
  return (v || "").slice(0, 256);
}

/**
 * Record one transcription attempt, whatever its outcome.
 *
 * A cache hit is as important as a provider call here: without the hit rows
 * there is no denominator, and the cache looks like it is never used.
 */
export function recordTranscription(env: Env, record: TranscribeTelemetry): void {
  try {
    const ae = env.TRANSCRIBE_AE;
    if (!ae) return;

    const status =
      record.outcome === "provider_error" || record.outcome === "cap_exceeded" ? "error" : "ok";

    const values: Record<(typeof TRANSCRIBE_BLOBS)[number], string> = {
      provider: record.provider || "",
      model: record.model || "",
      userId: record.userId || "anon",
      plan: record.plan || "unknown",
      status,
      errorCode: record.errorCode || "",
      language: record.language || "",
      country: record.country || "",
      outcome: record.outcome,
      fallbackUsed: record.fallbackUsed ? "1" : "0",
    };
    const numbers: Record<(typeof TRANSCRIBE_DOUBLES)[number], number> = {
      audioMinutes: finite(record.audioMinutes),
      costUsd: finite(record.costUsd),
      latencyMs: finite(record.latencyMs),
      segments: finite(record.segments),
      monthMinutesAfter: finite(record.monthMinutesAfter),
    };

    ae.writeDataPoint({
      blobs: TRANSCRIBE_BLOBS.map((k) => blob(values[k])),
      doubles: TRANSCRIBE_DOUBLES.map((k) => numbers[k]),
      // Index on outcome so hit-rate queries stay cheap as volume grows.
      indexes: [blob(record.outcome).slice(0, 96)],
    });
  } catch {
    // Observability is never worth a 500. See rule 1 in the file header.
  }
}

/** Country from Cloudflare's request metadata, empty off-Cloudflare. */
export function countryOf(req: Request): string {
  const cf = (req as Request & { cf?: { country?: string } }).cf;
  return cf?.country || req.headers.get("cf-ipcountry") || "";
}
