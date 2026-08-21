// Analytics Engine column layout for Listening Mode transcription.
//
// MIRROR OF web/src/lib/telemetry-schema.ts (TRANSCRIBE_* exports). The writer
// lives in this Worker (avc-api) and the reader lives in the web Worker's
// /owner dashboard, and the two are separate builds with no shared module. The
// root test suite pins the two copies byte-identical (see
// test/telemetry-schema-mirror.test.ts) because a silent divergence here does
// not fail a build: it makes the dashboard confidently mislabel columns.
//
// AE has no schema. A data point is a positional list of blobs and doubles and
// SQL addresses them as blob1..blob20 / double1..double20. Fields are
// APPEND-ONLY: never reorder or remove one, because historical rows keep the
// old positions forever and there is no error when the meaning shifts.

/** Dataset name as it appears in SQL FROM clauses (not the binding name). */
export const TRANSCRIBE_DATASET = "avc_transcribe";

export const TRANSCRIBE_BLOBS = [
  "provider",
  "model",
  "userId",
  "plan",
  "status",
  "errorCode",
  "language",
  "country",
  "outcome",
  "fallbackUsed",
] as const;

export const TRANSCRIBE_DOUBLES = [
  "audioMinutes",
  "costUsd",
  "latencyMs",
  "segments",
  "monthMinutesAfter",
] as const;

export type TranscribeBlob = (typeof TRANSCRIBE_BLOBS)[number];
export type TranscribeDouble = (typeof TRANSCRIBE_DOUBLES)[number];

/**
 * Why a transcription request cost what it did.
 *
 * `cache_hit` and `peer_hit` are the rows that were previously invisible: a
 * warm chunk did no provider call, charged no minutes, and wrote no telemetry
 * at all, which made the cache look like it did not exist. Recording them is
 * what turns "provider calls" into a real hit rate.
 */
export const TRANSCRIBE_OUTCOMES = [
  "provider_call",
  "cache_hit",
  "peer_hit",
  "cap_exceeded",
  "provider_error",
] as const;

export type TranscribeOutcome = (typeof TRANSCRIBE_OUTCOMES)[number];
