import { describe, expect, it } from "vitest";
import { answerList, audioRoute, bodyLimit, draftKey, gatewayRoute, restoreDraft, safeLink, type Draft } from "./core";
import type { N5Attempt, N5Question } from "../../../../shared/n5/contracts";
export const attempt: N5Attempt = { id: "11111111-1111-4111-8111-111111111111", courseId: "course", lessonId: "lesson", contentVersion: "v1", script: "romaji", revision: 0, status: "active", answers: [], result: null };
export const questions: N5Question[] = [{ id: "one", kind: "choice", skill: "vocabulary", objectiveId: "a", prompt: "Pick", choices: [{ id: "a", text: "Haru" }] }, { id: "two", kind: "production", skill: "writing", objectiveId: "b", prompt: "Write" }];
const draft = (): Draft => ({ version: 1, ownerId: "alice", attemptId: attempt.id, contentVersion: "v1", script: "romaji", revision: 0, answers: [{ questionId: "two", value: "I’m Haru" }], pending: null });
const restore = (d: unknown, a = attempt) => restoreDraft(JSON.stringify(d), "alice", a, questions);
describe("private gateway route boundary", () => {
  it("allows only required methods, safe IDs and a single pure-script lesson query", () => {
    for (const path of ["catalog", "courses/n5-foundations", "lessons/lesson", "me/progress", `attempts/${attempt.id}`]) expect(gatewayRoute(path.split("/"), "GET", new URLSearchParams())).toBe("/" + path);
    for (const path of ["enrolments", "events", "attempts", `attempts/${attempt.id}/answers`, `attempts/${attempt.id}/finish`]) expect(gatewayRoute(path.split("/"), "POST", new URLSearchParams())).toBe("/" + path);
    expect(gatewayRoute(["attempts", attempt.id], "DELETE", new URLSearchParams())).toBe(`/attempts/${attempt.id}`);
    for (const script of ["romaji", "kana"]) expect(gatewayRoute(["lessons", "lesson"], "GET", new URLSearchParams({ script }))).toBe(`/lessons/lesson?script=${script}`);
    for (const path of ["", "../catalog", "https://evil.test", "me/export", "me", `attempts/${attempt.id}/voice`, "attempts/not-uuid", "catalog/extra", "foo/catalog", "a".repeat(101), "courses/" + "a".repeat(101), "courses/a\n", "lessons/a\n"]) for (const method of ["GET", "POST", "DELETE"]) expect(gatewayRoute(path ? path.split("/") : [], method, new URLSearchParams())).toBeNull();
    for (const method of ["GET", "PUT", "DELETE"]) expect(gatewayRoute(["events"], method, new URLSearchParams())).toBeNull();
    expect(gatewayRoute(["catalog"], "PUT", new URLSearchParams())).toBeNull();
    expect(gatewayRoute(["attempts", attempt.id], "POST", new URLSearchParams())).toBeNull();
    for (const query of ["script=romaji-kana", "script=", "script=romaji&script=kana", "script=kana&userId=other", "other=kana"]) expect(gatewayRoute(["lessons", "lesson"], "GET", new URLSearchParams(query))).toBeNull();
    expect(gatewayRoute(["catalog"], "GET", new URLSearchParams("script=kana"))).toBeNull();
  });
});
describe("learning routes", () => {
  const id = attempt.id;
  it("admits audio, feedback and conversation routes with the right methods only", () => {
    const get = (path: string) => gatewayRoute(path.split("/"), "GET", new URLSearchParams());
    const post = (path: string) => gatewayRoute(path.split("/"), "POST", new URLSearchParams());
    expect(get("audio/0123456789abcdef")).toBe("/audio/0123456789abcdef");
    expect(get(`conversations/${id}`)).toBe(`/conversations/${id}`);
    expect(get(`conversations/${id}/turns/12/audio`)).toBe(`/conversations/${id}/turns/12/audio`);
    expect(post(`attempts/${id}/feedback`)).toBe(`/attempts/${id}/feedback`);
    expect(post("conversations")).toBe("/conversations");
    expect(post(`conversations/${id}/turns`)).toBe(`/conversations/${id}/turns`);
    expect(post(`conversations/${id}/finish`)).toBe(`/conversations/${id}/finish`);
    expect(gatewayRoute(["conversations", id], "DELETE", new URLSearchParams())).toBe(`/conversations/${id}`);
    for (const bad of ["audio/0123", "audio/0123456789ABCDEF", "audio/0123456789abcdef0", `conversations/${id}/turns/1234/audio`, `conversations/${id}/turns/x/audio`, "conversations/not-a-uuid", `conversations/${id}/grade`]) {
      expect(get(bad)).toBeNull();
      expect(post(bad)).toBeNull();
    }
    expect(post("audio/0123456789abcdef")).toBeNull();
    expect(get(`attempts/${id}/feedback`)).toBeNull();
    expect(gatewayRoute(["audio", "0123456789abcdef"], "GET", new URLSearchParams("script=kana"))).toBeNull();
  });
  it("marks only audio routes binary and only turns large", () => {
    expect(audioRoute("/audio/0123456789abcdef")).toBe(true);
    expect(audioRoute(`/conversations/${id}/turns/2/audio`)).toBe(true);
    expect(audioRoute(`/conversations/${id}`)).toBe(false);
    expect(bodyLimit(`/conversations/${id}/turns`)).toBe(900_000);
    for (const path of ["/conversations", `/attempts/${id}/answers`, `/conversations/${id}/finish`]) expect(bodyLimit(path)).toBe(16_384);
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
    const two = [{ questionId: "one", value: "a" }, { questionId: "two", value: "x" }];
    expect(restore({ ...draft(), answers: two })).not.toBeNull();
    expect(restore({ ...draft(), answers: [two[0], { questionId: "two", value: "" }] })).toBeNull();
    expect(restore({ ...draft(), answers: [{ questionId: "two", value: ["x"] }] })).toBeNull();
    const base = JSON.stringify({ ...draft(), padding: "" });
    expect(restoreDraft(JSON.stringify({ ...draft(), padding: "x".repeat(40000 - base.length) }), "alice", attempt, questions)).not.toBeNull();
    expect(restoreDraft(JSON.stringify({ ...draft(), padding: "x".repeat(40001 - base.length) }), "alice", attempt, questions)).toBeNull();
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
  expect(safeLink("https://evil.test/story/x", "source")).toBeNull();
  expect(safeLink("https://www.yourlieinapril.com/story/x", "watch")).toBeNull();
  expect(safeLink("https://www.yourlieinapril.com/other/x", "source")).toBeNull();
});
