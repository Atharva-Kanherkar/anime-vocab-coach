import type { N5Answer, N5Attempt, N5Question } from "../../../../shared/n5/contracts";

export interface Snapshot { revision: number; idempotencyKey: string; answers: N5Answer[] }
export interface Draft {
  version: 1; ownerId: string; attemptId: string; contentVersion: string; script: string;
  revision: number; answers: N5Answer[]; pending: Snapshot | null;
}
const key = /^[a-zA-Z0-9_-]{1,100}$/;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
/** Binary audio routes; every other route is bounded JSON. */
export function audioRoute(path: string): boolean {
  return /^\/audio\/[0-9a-f]{16}$/.test(path) || new RegExp(`^/conversations/${uuid}/turns/\\d{1,3}/audio$`).test(path);
}
/** Only a speaking turn may carry a recording; everything else stays at 16 KiB. */
export function bodyLimit(path: string): number {
  return new RegExp(`^/conversations/${uuid}/turns$`).test(path) ? 900_000 : 16_384;
}
export function gatewayRoute(parts: string[], method: string, query: URLSearchParams): string | null {
  if (!parts.length || parts.some((part) => part !== part.trim() || !/^[a-z0-9-]{1,100}$/.test(part))) return null;
  const path = "/" + parts.join("/");
  const get = /^(\/catalog|\/courses\/[a-z0-9-]+|\/lessons\/[a-z0-9-]+|\/me\/progress)$/.test(path) || new RegExp(`^/(attempts|conversations)/${uuid}$`).test(path) || audioRoute(path);
  const post = ["/enrolments", "/events", "/attempts", "/conversations"].includes(path) || new RegExp(`^/attempts/${uuid}/(answers|finish|feedback)$`).test(path) || new RegExp(`^/conversations/${uuid}/(turns|finish)$`).test(path);
  const del = new RegExp(`^/(attempts|conversations)/${uuid}$`).test(path);
  if (!((method === "GET" && get) || (method === "POST" && post) || (method === "DELETE" && del))) return null;
  if (query.size) {
    if (!path.startsWith("/lessons/") || method !== "GET" || query.size !== 1 || !["romaji", "kana"].includes(query.get("script") ?? "")) return null;
    return path + "?script=" + query.get("script");
  }
  return path;
}
export function answerList(values: Record<string, string>, questions: N5Question[]): N5Answer[] {
  return questions.filter((q) => typeof values[q.id] === "string" && values[q.id] !== "").map((q) => ({ questionId: q.id, value: values[q.id] }));
}
export function draftKey(ownerId: string, attemptId: string): string {
  return `avc:n5:v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(attemptId)}`;
}
export function restoreDraft(raw: string | null, ownerId: string, attempt: N5Attempt, questions: N5Question[]): Draft | null {
  if (!raw || raw.length > 40_000 || attempt.status !== "active") return null;
  try {
    const d = JSON.parse(raw) as Draft;
    if (!d || d.version !== 1 || d.ownerId !== ownerId || d.attemptId !== attempt.id || d.contentVersion !== attempt.contentVersion || d.script !== attempt.script) return null;
    const revision = (n: number) => Number.isInteger(n) && n >= 0 && n <= 1_000_000;
    const answers = (a: N5Answer[]) => Array.isArray(a) && a.length <= questions.length && new Set(a.map((x) => x.questionId)).size === a.length && a.every((x) => questions.some((q) => q.id === x.questionId) && typeof x.value === "string" && x.value.length >= 1 && x.value.length <= 500);
    if (!revision(d.revision) || !answers(d.answers)) return null;
    if (d.pending !== null && (!d.pending || !revision(d.pending.revision) || d.pending.revision !== d.revision || typeof d.pending.idempotencyKey !== "string" || !key.test(d.pending.idempotencyKey) || !answers(d.pending.answers) || !d.pending.answers.length)) return null;
    // Project fields; untrusted storage may not inject grade or identity claims.
    return { version: 1, ownerId, attemptId: attempt.id, contentVersion: attempt.contentVersion, script: attempt.script,
      revision: d.revision, answers: d.answers.map(({ questionId, value }) => ({ questionId, value })),
      pending: d.pending ? { revision: d.pending.revision, idempotencyKey: d.pending.idempotencyKey, answers: d.pending.answers.map(({ questionId, value }) => ({ questionId, value })) } : null };
  } catch { return null; }
}
export function safeLink(raw: string, kind: "watch" | "source"): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    if (kind === "watch" && u.hostname === "www.crunchyroll.com" && u.pathname.startsWith("/series/")) return u.href;
    if (kind === "source" && u.hostname === "www.yourlieinapril.com" && u.pathname.startsWith("/story/")) return u.href;
    return null;
  } catch { return null; }
}
