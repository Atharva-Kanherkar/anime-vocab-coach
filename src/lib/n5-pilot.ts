import type { N5ExtensionState, N5Script } from "../../shared/n5/contracts";
import { parseN5CourseContext, type N5CourseContext } from "./n5-course-context";
export type PilotState = N5ExtensionState;
export interface WatchEvent { episodeId: string; contentVersion: string; idempotencyKey: string; observedAt: number }
export const N5_QUEUE_LIMIT = 100;
const id = /^[a-z0-9][a-z0-9-]{0,127}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max = 500): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
export function isStreamingUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.port && !u.username && !u.password && ["youtube.com", "netflix.com", "crunchyroll.com"].some(h => u.hostname === h || u.hostname.endsWith("." + h));
  } catch { return false; }
}
export function pureReading(value: unknown, script: N5Script): value is string {
  if (!text(value)) return false;
  // Same normalized view as the API: full-width ？！ and IME spaces are ordinary kana punctuation.
  const normalized = value.normalize("NFKC");
  return script === "romaji" ? /^[A-Za-zāīūēōâîûêôĀĪŪĒŌ0-9 .,!?'():;-]+$/.test(normalized) && /[A-Za-zāīūēō]/i.test(normalized)
    : /^[\u3041-\u3096\u30a1-\u30faー 。、!?「」『』():・〜~.]+$/.test(normalized) && /[\u3041-\u3096\u30a1-\u30fa]/.test(normalized);
}
export function parseN5PilotState(value: unknown): PilotState | null {
  if (!obj(value) || value.apiVersion !== 1 || !text(value.ownerId, 128) || value.mastery !== false || typeof value.watched !== "boolean" || !Number.isSafeInteger(value.completedAttempts) || (value.completedAttempts as number) < 0) return null;
  const context = value.context === null ? null : parseN5CourseContext(value.context);
  if (value.context !== null && !context) return null;
  let lesson: PilotState["lesson"] = null;
  if (context) {
    const l = value.lesson;
    if (!obj(l) || l.id !== context.lessonId || l.script !== context.script || l.contentVersion !== context.contentVersion || !text(l.canDo) || !Array.isArray(l.vocabulary) || l.vocabulary.length > 20 || !Array.isArray(l.grammar) || l.grammar.length > 10) return null;
    const vocabulary: NonNullable<PilotState["lesson"]>["vocabulary"] = [];
    const grammar: NonNullable<PilotState["lesson"]>["grammar"] = [];
    for (const v of l.vocabulary) {
      if (!obj(v) || !text(v.id, 128) || !pureReading(v.reading, context.script) || !text(v.meaning, 250)) return null;
      vocabulary.push({ id: v.id, reading: v.reading, meaning: v.meaning });
    }
    for (const g of l.grammar) {
      if (!obj(g) || !text(g.id, 128) || !pureReading(g.example, context.script) || !text(g.explanation)) return null;
      grammar.push({ id: g.id, explanation: g.explanation, example: g.example });
    }
    // Optional display context from newer APIs; malformed values are dropped, never trusted.
    const unit = Number.isSafeInteger(l.unit) && (l.unit as number) >= 1 && (l.unit as number) <= 99 ? l.unit as number : undefined;
    const title = text(l.title, 120) ? l.title : undefined;
    const episode = obj(l.episode) && Number.isSafeInteger(l.episode.number) && (l.episode.number as number) >= 1 && (l.episode.number as number) <= 999 && text(l.episode.title, 120)
      ? { number: l.episode.number as number, title: l.episode.title } : undefined;
    lesson = { id: context.lessonId, contentVersion: context.contentVersion, script: context.script, canDo: l.canDo, vocabulary, grammar,
      ...(unit ? { unit } : {}), ...(title ? { title } : {}), ...(episode ? { episode } : {}) };
  } else if (value.lesson !== null) return null;
  if (!Array.isArray(value.activeAttempts) || value.activeAttempts.length > 5) return null;
  const activeAttempts: PilotState["activeAttempts"] = [];
  for (const a of value.activeAttempts) {
    if (!obj(a) || !text(a.id) || !uuid.test(a.id) || (a.script !== "romaji" && a.script !== "kana")) return null;
    activeAttempts.push({ id: a.id, script: a.script });
  }
  return { apiVersion: 1, ownerId: value.ownerId, context, lesson, watched: value.watched, activeAttempts, completedAttempts: value.completedAttempts as number, mastery: false };
}
export function hostedPracticeUrl(context: N5CourseContext, attemptId?: string): string {
  if (!parseN5CourseContext(context) || !id.test(context.lessonId) || (attemptId !== undefined && !uuid.test(attemptId))) throw new Error("Invalid course route");
  return attemptId ? `https://animevocab.com/app/n5/attempts/${attemptId}` : `https://animevocab.com/app/n5/lessons/${context.lessonId}?script=${context.script}`;
}
export function queueObservation(queue: WatchEvent[], event: WatchEvent): WatchEvent[] {
  if (!id.test(event.episodeId) || !id.test(event.contentVersion) || !/^[a-zA-Z0-9_-]{1,100}$/.test(event.idempotencyKey) || !Number.isSafeInteger(event.observedAt) || event.observedAt < 1) throw new Error("Invalid observation");
  const same = queue.find(e => e.idempotencyKey === event.idempotencyKey);
  if (same) {
    if (JSON.stringify(same) !== JSON.stringify(event)) throw new Error("Conflicting observation");
    return queue;
  }
  if (queue.some(e => e.episodeId === event.episodeId && e.contentVersion === event.contentVersion)) return queue;
  if (queue.length >= N5_QUEUE_LIMIT) throw new Error("Pending observations are full. Retry sync before recording more.");
  return [...queue, event];
}
export interface PilotCommand { type: string; tabId?: number; script?: N5Script; refresh?: boolean; confirmJapanese?: boolean }
export function parseN5Command(raw: unknown): PilotCommand | null {
  if (!obj(raw)) return null;
  const fields: Record<string, string[]> = {
    "avc-n5-state": ["refresh"], "avc-n5-enrol": ["script"], "avc-n5-attach": ["tabId", "confirmJapanese"],
    "avc-n5-watch": ["tabId"], "avc-n5-start-assessment": ["tabId"], "avc-n5-detach": ["tabId"],
    "avc-n5-session": [], "avc-n5-invalidated": [], "avc-n5-refresh": [],
  };
  if (typeof raw.type !== "string" || !Object.prototype.hasOwnProperty.call(fields, raw.type) || Object.keys(raw).some(k => k !== "type" && !fields[raw.type as string].includes(k))) return null;
  if (raw.tabId !== undefined && (!Number.isSafeInteger(raw.tabId) || (raw.tabId as number) <= 0)) return null;
  if (raw.script !== undefined && raw.script !== "kana" && raw.script !== "romaji") return null;
  if (raw.refresh !== undefined && typeof raw.refresh !== "boolean") return null;
  if (raw.confirmJapanese !== undefined && typeof raw.confirmJapanese !== "boolean") return null;
  if (raw.type === "avc-n5-enrol" && raw.script === undefined) return null;
  if (["avc-n5-attach"].includes(raw.type) && raw.tabId === undefined) return null;
  return raw as unknown as PilotCommand;
}
