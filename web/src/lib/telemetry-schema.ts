// Analytics Engine column layout, defined ONCE and shared by the writer
// (telemetry.ts) and the reader (telemetry-query.ts).
//
// AE has no schema: a data point is a positional list of blobs and doubles,
// and SQL addresses them as blob1..blob20 / double1..double20. If the writer
// and the dashboard disagree about what blob4 means, the dashboard shows
// confidently wrong numbers with no error. Deriving both sides from these
// arrays makes that class of bug impossible — add a field only by APPENDING,
// never by reordering or removing, because historical rows keep the old
// positions forever.

/** Dataset names as they appear in SQL FROM clauses (not the binding names). */
export const LLM_DATASET = "avc_llm";
export const EVENT_DATASET = "avc_events";
/** Pre-existing dataset from the extension funnel work. */
export const EXTENSION_DATASET = "extension_funnel";

export const LLM_BLOBS = [
  "model",
  "operation",
  "userId",
  "plan",
  "status",
  "errorCode",
  "effort",
  "country",
  "surface",
  "direction",
] as const;

export const LLM_DOUBLES = [
  "inputTokens",
  "outputTokens",
  "reasoningTokens",
  "cachedInputTokens",
  "costUsd",
  "latencyMs",
] as const;

export const EVENT_BLOBS = [
  "kind",
  "name",
  "userId",
  "plan",
  "country",
  "city",
  "referrerHost",
  "device",
  "authKind",
  "status",
  "utmSource",
  "utmMedium",
  "utmCampaign",
] as const;

export const EVENT_DOUBLES = ["durationMs"] as const;

export type LlmBlob = (typeof LLM_BLOBS)[number];
export type LlmDouble = (typeof LLM_DOUBLES)[number];
export type EventBlob = (typeof EVENT_BLOBS)[number];
export type EventDouble = (typeof EVENT_DOUBLES)[number];

/** `blob1 AS model, blob2 AS operation, …` for SELECT clauses. */
export function selectAliases(blobs: readonly string[], doubles: readonly string[]): string {
  return [
    ...blobs.map((name, i) => `blob${i + 1} AS ${name}`),
    ...doubles.map((name, i) => `double${i + 1} AS ${name}`),
  ].join(", ");
}

/** The AE column backing a named field, for use in WHERE/GROUP BY. */
export function columnFor(
  field: string,
  blobs: readonly string[],
  doubles: readonly string[]
): string {
  const b = blobs.indexOf(field);
  if (b >= 0) return `blob${b + 1}`;
  const d = doubles.indexOf(field);
  if (d >= 0) return `double${d + 1}`;
  throw new Error(`unknown telemetry field: ${field}`);
}

export const llmColumn = (f: LlmBlob | LlmDouble) => columnFor(f, LLM_BLOBS, LLM_DOUBLES);
export const eventColumn = (f: EventBlob | EventDouble) => columnFor(f, EVENT_BLOBS, EVENT_DOUBLES);

// ------------------------------------------- Transcription (avc-api Worker)
//
// MIRROR of backend/src/telemetry-schema.ts. The writer is the avc-api Worker
// and the reader is this app's /owner dashboard; they are separate builds with
// no shared module, so the two lists must be kept identical by hand. The root
// test suite pins them (test/telemetry-schema-mirror.test.ts) because a
// divergence does not fail a build, it silently mislabels dashboard columns.
//
// APPEND-ONLY, same as the datasets above.

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

/** Why a transcription cost what it did. `cache_hit`/`peer_hit` are the rows
 *  that used to be invisible, and they are the denominator of the hit rate. */
export const TRANSCRIBE_OUTCOMES = [
  "provider_call",
  "cache_hit",
  "peer_hit",
  "cap_exceeded",
  "provider_error",
] as const;

export type TranscribeOutcome = (typeof TRANSCRIBE_OUTCOMES)[number];

export const transcribeColumn = (f: TranscribeBlob | TranscribeDouble) =>
  columnFor(f, TRANSCRIBE_BLOBS, TRANSCRIBE_DOUBLES);
