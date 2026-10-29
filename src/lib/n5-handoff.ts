/**
 * Narrow N5 handoff message contract for the extension.
 *
 * The popup/background may only drive hosted assessment handoffs through
 * message types whitelisted here, and only with payloads that pass this
 * validator. Content scripts cannot send trusted grade claims or credentials;
 * the hosted runner owns answers, and handoff messages must never carry
 * secrets, answer keys, raw summaries, audio or bearer tokens.
 */

export const N5_HANDOFF_MESSAGE_TYPES = [
  "avc-n5-start-assessment",
  "avc-n5-abandon-attempt",
] as const;

export type N5HandoffMessageType = (typeof N5_HANDOFF_MESSAGE_TYPES)[number];

export interface N5HandoffMessage {
  type: N5HandoffMessageType;
  tabId?: number;
  lessonId?: string;
  attemptId?: string;
}

const HANDOFF_KEYS = ["type", "tabId", "lessonId", "attemptId"] as const;
const MAX_ID_LENGTH = 128;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHandoffType(value: unknown): value is N5HandoffMessageType {
  return (
    typeof value === "string" &&
    (N5_HANDOFF_MESSAGE_TYPES as readonly string[]).includes(value)
  );
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isBoundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

/** Strict handoff-message validation. Unknown fields are rejected so a content
 * script cannot smuggle unvetted fields into the handoff path. */
export function isN5HandoffMessage(value: unknown): value is N5HandoffMessage {
  if (!isPlainObject(value)) return false;
  const type = value.type;
  if (!isHandoffType(type)) return false;
  const unknown = Object.keys(value).filter((key) => !(HANDOFF_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) return false;
  if ("tabId" in value && value.tabId !== undefined && !isPositiveInt(value.tabId)) return false;
  if ("lessonId" in value && value.lessonId !== undefined && !isBoundedId(value.lessonId)) return false;
  if ("attemptId" in value && value.attemptId !== undefined && !isBoundedId(value.attemptId)) return false;
  return true;
}
