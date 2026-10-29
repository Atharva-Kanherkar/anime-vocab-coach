/**
 * N5 course context for the extension's course mode.
 *
 * Course context is versioned server data (course/track/unit/episode/lesson +
 * content version + pure script) that the learner picks or that the backend
 * returns. The extension must key practice on these identifiers — never on a
 * guessed tab title — and never store or forward credentials, answer keys, raw
 * summaries, audio or bearer tokens here.
 */

export const N5_SCRIPT_VALUES = ["romaji", "kana"] as const;
export type N5Script = (typeof N5_SCRIPT_VALUES)[number];

export interface N5CourseContext {
  courseId: string;
  trackId: string;
  unitId: string;
  episodeId: string;
  lessonId: string;
  contentVersion: string;
  script: N5Script;
}

const CONTEXT_KEYS = [
  "courseId",
  "trackId",
  "unitId",
  "episodeId",
  "lessonId",
  "contentVersion",
  "script",
] as const;

const MAX_CONTEXT_ID_LENGTH = 128;

export function isN5Script(value: unknown): value is N5Script {
  return typeof value === "string" && (N5_SCRIPT_VALUES as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Strict parse of a backend/hosted course context. Unknown fields are
 * rejected, mirroring the backend's strict request-schema authority; malformed
 * input returns null instead of throwing. */
export function parseN5CourseContext(input: unknown): N5CourseContext | null {
  if (!isPlainObject(input)) return null;
  const parsed: Record<string, unknown> = {};
  for (const key of CONTEXT_KEYS) {
    const value = input[key];
    if (typeof value !== "string") return null;
    if (value.length === 0 || value.length > MAX_CONTEXT_ID_LENGTH) return null;
    parsed[key] = value;
  }
  const script = input.script;
  if (!isN5Script(script)) return null;
  parsed.script = script;
  const unknown = Object.keys(input).filter((key) => !(CONTEXT_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) return null;
  return parsed as unknown as N5CourseContext;
}

/** Namespaced chrome.storage.local key for the signed-in owner's context. */
export function n5CourseStorageKey(userId: string | null | undefined): string {
  return `n5Course:${userId || "anonymous"}`;
}

/** Persist a validated course context for the owner. Returns false when the
 * context was malformed, so callers cannot cache unvalidated server data. */
export async function saveN5CourseContext(
  userId: string | null | undefined,
  context: N5CourseContext | null
): Promise<boolean> {
  if (!context) return false;
  if (!parseN5CourseContext(context)) return false;
  const key = n5CourseStorageKey(userId);
  await chrome.storage.local.set({ [key]: context });
  return true;
}

/** Load and re-validate the stored context; never trust stored bytes alone. */
export async function loadN5CourseContext(
  userId: string | null | undefined
): Promise<N5CourseContext | null> {
  const key = n5CourseStorageKey(userId);
  const stored = await chrome.storage.local.get([key]);
  const raw = (stored as Record<string, unknown> | undefined)?.[key];
  return parseN5CourseContext(raw);
}
