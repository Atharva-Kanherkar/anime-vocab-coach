import { describe, expect, it } from "vitest";
import { answerList, draftKey, gatewayRoute, restoreDraft, safeLink, type Draft } from "./core";
import type { N5Attempt, N5Question } from "../../../../shared/n5/contracts";
export const attempt: N5Attempt = { id: "11111111-1111-4111-8111-111111111111", courseId: "course", lessonId: "lesson", contentVersion: "v1", script: "romaji", revision: 0, status: "active", answers: [], result: null };
export const questions: N5Question[] = [{ id: "one", kind: "choice", objectiveId: "a", prompt: "Pick", choices: [{ id: "a", text: "Haru" }] }, { id: "two", kind: "production", objectiveId: "b", prompt: "Write" }];
const draft = (): Draft => ({ version: 1, ownerId: "alice", attemptId: attempt.id, contentVersion: "v1", script: "romaji", revision: 0, answers: [{ questionId: "two", value: "I’m Haru" }], pending: null });
const restore = (d: unknown, a = attempt) => restoreDraft(JSON.stringify(d), "alice", a, questions);
describe("private gateway route boundary", () => {
  it("allows only required methods, safe IDs and a single pure-script lesson query", () => {
    for (const path of ["catalog", "courses/n5-foundations", "lessons/lesson", "me/progress", `attempts/${attempt.id}`]) expect(gatewayRoute(path.split("/"), "GET", new URLSearchParams())).toBe("/" + path);
    for (const path of ["enrolments", "events", "attempts", `attempts/${attempt.id}/answers`, `attempts/${attempt.id}/finish`]) expect(gatewayRoute(path.split("/"), "POST", new URLSearchParams())).toBe("/" + path);
    expect(gatewayRoute(["attempts", attempt.id], "DELETE", new URLSearchParams())).toBe(`/attempts/${attempt.id}`);
    for (const script of ["romaji", "kana"]) expect(gatewayRoute(["lessons", "lesson"], "GET", new URLSearchParams({ script }))).toBe(`/lessons/lesson?script=${script}`);
    for (const path of ["", "../catalog", "https://evil.test", "me/export", "me", `attempts/${attempt.id}/voice`, "attempts/not-uuid", "catalog/extra", "a".repeat(101)]) for (const method of ["GET", "POST", "DELETE"]) expect(gatewayRoute(path ? path.split("/") : [], method, new URLSearchParams())).toBeNull();
    expect(gatewayRoute(["catalog"], "PUT", new URLSearchParams())).toBeNull();
    expect(gatewayRoute(["attempts", attempt.id], "POST", new URLSearchParams())).toBeNull();
    for (const query of ["script=romaji-kana", "script=", "script=romaji&script=kana", "script=kana&userId=other", "other=kana"]) expect(gatewayRoute(["lessons", "lesson"], "GET", new URLSearchParams(query))).toBeNull();
    expect(gatewayRoute(["catalog"], "GET", new URLSearchParams("script=kana"))).toBeNull();
  });
});
describe("scoped private drafts", () => {
  it("preserves original text and pending receipt identity, projecting away extra claims", () => {
    const d = draft();
    expect(restore(d)).toEqual(d);
    d.pending = { revision: 0, idempotencyKey: "retry_1", answers: d.answers };
    expect(restore({ ...d, mastery: true })).toEqual(d);
    expect(restore({ ...d, pending: { ...d.pending, passed: true } })).toEqual(d);
    expect(draftKey("a:b", "c")).not.toBe(draftKey("a", "b:c"));
    expect(draftKey("alice", attempt.id)).toBe(`avc:n5:v1:alice:${attempt.id}`);
  });
  it("rejects malformed, cross-account, wrong-version and out-of-bound drafts", () => {
    for (const raw of [null, "{", "x".repeat(40001)]) expect(restoreDraft(raw, "alice", attempt, questions)).toBeNull();
    expect(restoreDraft("x".repeat(40000), "alice", attempt, questions)).toBeNull();
    for (const extra of [{ version: 2 }, { ownerId: "bob" }, { attemptId: "other" }, { contentVersion: "v2" }, { script: "kana" }, { revision: -1 }, { revision: 0.5 }, { revision: 1000001 }, { answers: null }, { answers: [{ questionId: "missing", value: "x" }] }, { answers: [{ questionId: "two", value: "" }] }, { answers: [{ questionId: "two", value: "x".repeat(501) }] }, { answers: [{ questionId: "two", value: "a" }, { questionId: "two", value: "b" }] }]) expect(restore({ ...draft(), ...extra })).toBeNull();
    expect(restore(null)).toBeNull();
    expect(restore(draft(), { ...attempt, status: "complete" })).toBeNull();
    expect(restore({ ...draft(), revision: 1000000, answers: [{ questionId: "two", value: "x".repeat(500) }] })).not.toBeNull();
    for (const pending of [false, {}, { revision: 1, idempotencyKey: "key", answers: draft().answers }, { revision: 0, idempotencyKey: "bad/key", answers: draft().answers }, { revision: 0, idempotencyKey: 123, answers: draft().answers }, { revision: 0, idempotencyKey: "key", answers: [] }]) expect(restore({ ...draft(), pending })).toBeNull();
  });
  it("orders snapshots by lesson questions, preserves Unicode and treats blank as omission", () => {
    expect(answerList({ unknown: "ignored", two: "ハル　です", one: "a" }, questions)).toEqual([{ questionId: "one", value: "a" }, { questionId: "two", value: "ハル　です" }]);
    expect(answerList({ one: "", two: " " }, questions)).toEqual([{ questionId: "two", value: " " }]);
    expect(answerList({}, questions)).toEqual([]);
  });
});
it("allows only official HTTPS watch/source links", () => {
  expect(safeLink("https://www.crunchyroll.com/series/ABC/show", "watch")).toBe("https://www.crunchyroll.com/series/ABC/show");
  expect(safeLink("https://www.yourlieinapril.com/story/01.html", "source")).toBe("https://www.yourlieinapril.com/story/01.html");
  for (const raw of ["", "javascript:alert(1)", "http://www.crunchyroll.com/series/x", "https://evil.test/series/x", "https://www.crunchyroll.com.evil.test/series/x", "https://u:p@www.crunchyroll.com/series/x", "https://www.crunchyroll.com:8443/series/x", "https://www.crunchyroll.com/watch/x"]) expect(safeLink(raw, "watch")).toBeNull();
  expect(safeLink("https://www.crunchyroll.com/series/x", "source")).toBeNull();
  expect(safeLink("https://www.yourlieinapril.com/other/x", "source")).toBeNull();
});
