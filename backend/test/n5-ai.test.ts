import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { runtime } from "./runtime";
import { CONTENT_VERSION, TRACK_ID, correctAnswers } from "./answers";
import { CLIPS, LESSONS, lessonIdFor } from "../src/n5/course";

let app: Awaited<ReturnType<typeof runtime>>;
beforeAll(async () => { app = await runtime(); });
afterAll(async () => { await app.mf.dispose(); });
afterEach(async () => {
  app.openai.calls.length = 0;
  app.openai.fail.clear();
  for (const token of ["avc_st_n5local", "avc_st_n5other"]) await app.request("/me", { method: "DELETE", token });
});
const enrol = (script: "romaji" | "kana", token?: string) => app.request("/enrolments", { body: { trackId: TRACK_ID, script, idempotencyKey: `enrol-${script}` }, token });
const speechCalls = () => app.openai.calls.filter((c) => c.path === "/v1/audio/speech").length;
const chatCalls = (schema: string) => app.openai.calls.filter((c) => c.schema === schema).length;

let attemptKey = 0;
async function finishedAttempt(unit: number, script: "romaji" | "kana", typed?: string[]) {
  await enrol(script);
  const lessonId = lessonIdFor(unit);
  const attempt = await (await app.request("/attempts", { body: { lessonId, contentVersion: CONTENT_VERSION, idempotencyKey: `create-${++attemptKey}` } })).json();
  const answers = correctAnswers(script, unit);
  typed?.forEach((value, index) => { answers[answers.length - typed.length + index].value = value; });
  expect((await app.request(`/attempts/${attempt.id}/answers`, { body: { revision: 0, idempotencyKey: `answers-${attempt.id}`, answers } })).status).toBe(200);
  const finished = await (await app.request(`/attempts/${attempt.id}/finish`, { body: { revision: 1 } })).json();
  expect(finished.status).toBe("complete");
  return finished;
}

describe("every lesson", () => {
  it.each(["romaji", "kana"] as const)("loads all 24 lessons in %s without answer keys", async (script) => {
    for (const lesson of LESSONS) {
      const response = await app.request(`/lessons/${lesson.id}?script=${script}`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ id: lesson.id, script, unit: lesson.unit });
      expect(JSON.stringify(body)).not.toMatch(/correctOption|references|transcript|"explanation":"[^"]*","correct/);
    }
    expect((await app.request("/lessons/your-lie-in-april-u25")).status).toBe(404);
  });
});

describe("typed-answer feedback", () => {
  it("marks reference matches correct without a provider call and stores the result", async () => {
    const attempt = await finishedAttempt(5, "romaji", ["Byouin wa doko desu ka", "kaori san wa byouin ni imasu"]);
    const feedback = await (await app.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json();
    expect(feedback).toMatchObject({ attemptId: attempt.id, script: "romaji", source: "match" });
    expect(feedback.items.map((i: { verdict: string }) => i.verdict)).toEqual(["correct", "correct"]);
    expect(chatCalls("typed_feedback")).toBe(0);
  });

  it("asks the tutor model once for other answers, validates the script and replays from storage", async () => {
    const attempt = await finishedAttempt(5, "kana", ["びょういんは どこ", "カオリさんが びょういんに います"]);
    const first = await (await app.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json();
    expect(first.source).toBe("ai");
    expect(first.items).toHaveLength(2);
    for (const item of first.items) {
      expect(item.verdict).toBe("close");
      expect(item.correction).toMatch(/^[ぁ-ヿ ー。、？！]+$/);
      expect(item.references.length).toBeGreaterThan(0);
    }
    expect(await (await app.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json()).toEqual(first);
    expect(chatCalls("typed_feedback")).toBe(1);
    const sent = app.openai.calls.find((c) => c.schema === "typed_feedback")!.body as { messages: { content: string }[] };
    expect(sent.messages[0].content).toContain("ONLY in kana");
  });

  it("falls back without storing when the provider fails, then upgrades on retry", async () => {
    const attempt = await finishedAttempt(6, "romaji", ["ima nan desu", "tesuto ashita"]);
    app.openai.fail.add("typed_feedback");
    const fallback = await (await app.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json();
    expect(fallback.source).toBe("fallback");
    expect(fallback.items.every((i: { verdict: string }) => i.verdict === "unchecked")).toBe(true);
    app.openai.fail.clear();
    expect((await (await app.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json()).source).toBe("ai");
  });

  it("refuses active attempts, other owners and request bodies", async () => {
    await enrol("romaji");
    const active = await (await app.request("/attempts", { body: { lessonId: lessonIdFor(2), contentVersion: CONTENT_VERSION, idempotencyKey: "active" } })).json();
    expect((await (await app.request(`/attempts/${active.id}/feedback`, { body: {} })).json()).error.code).toBe("attempt_active");
    const done = await finishedAttempt(1, "romaji");
    expect((await app.request(`/attempts/${done.id}/feedback`, { body: {}, token: "avc_st_n5other" })).status).toBe(404);
    expect((await app.request(`/attempts/${done.id}/feedback`, { body: { grade: "correct" } })).status).toBe(400);
  });
});

describe("audio", () => {
  const clip = LESSONS[2].vocabulary[0].audio;
  it("synthesises a registered clip once and serves the cache afterwards", async () => {
    const first = await app.request(`/audio/${clip}`);
    expect(first.status).toBe(200);
    expect(first.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(first.headers.get("Cache-Control")).toContain("immutable");
    const bytes = new TextDecoder().decode(await first.arrayBuffer());
    expect(bytes).toContain(CLIPS.get(clip)!);
    expect((await app.request(`/audio/${clip}`)).status).toBe(200);
    expect(speechCalls()).toBe(1);
    expect((app.openai.calls[0].body as { input: string }).input).toBe(CLIPS.get(clip));
  });
  it("rejects unknown clips and caches nothing when the provider fails", async () => {
    expect((await app.request("/audio/0000000000000000")).status).toBe(404);
    expect((await app.request("/audio/NOTHEX")).status).toBe(404);
    app.openai.fail.add("speech");
    const other = LESSONS[3].vocabulary[1].audio;
    const failed = await app.request(`/audio/${other}`);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("audio_unavailable");
    app.openai.fail.clear();
    expect((await app.request(`/audio/${other}`)).status).toBe(200);
    expect(speechCalls()).toBe(2);
  });
  it("requires an authorised caller", async () => {
    expect((await app.request(`/audio/${clip}`, { token: null })).status).toBe(401);
    expect((await app.request(`/audio/${clip}`, { token: "avc_st_denied" })).status).toBe(404);
  });
});

describe("speaking practice", () => {
  const start = (unit: number, key: string, token?: string) => app.request("/conversations", { body: { lessonId: lessonIdFor(unit), idempotencyKey: key }, token });
  const turn = (id: string, afterSeq: number, key: string, extra: Record<string, unknown>, token?: string) => app.request(`/conversations/${id}/turns`, { body: { afterSeq, idempotencyKey: key, ...extra }, token });
  const voice = { audio: { data: btoa("webm-bytes-for-testing"), mime: "audio/webm" } };

  it("runs a full voice and typed conversation with replay, conflicts and grading", async () => {
    expect((await start(1, "no-enrolment")).status).toBe(409);
    await enrol("kana");
    const conversation = await (await start(1, "talk")).json();
    expect(conversation).toMatchObject({ lessonId: lessonIdFor(1), script: "kana", status: "active", maxLearnerTurns: 10, result: null });
    expect(conversation.turns).toEqual([{ seq: 0, role: "tutor", text: "はじめまして。わたしは ハルです。おなまえは？", english: expect.any(String), tip: null, correction: null, audio: true }]);
    expect(await (await start(1, "talk")).json()).toEqual(conversation);
    expect((await (await start(1, "other-key")).json()).id).toBe(conversation.id);

    const afterVoice = await (await turn(conversation.id, 0, "t1", voice)).json();
    expect(afterVoice.turns).toHaveLength(3);
    expect(afterVoice.turns[1]).toEqual({ seq: 1, role: "learner", text: "わたしは がくせいです。", english: null, input: "voice", audio: false });
    expect(afterVoice.turns[2]).toMatchObject({ seq: 2, role: "tutor", text: "そうですか。ハルも がくせいです。", tip: "Try asking a question back.", audio: true });
    expect(JSON.stringify(afterVoice)).not.toContain("raw");
    expect(app.openai.calls.filter((c) => c.path === "/v1/audio/transcriptions")).toHaveLength(1);

    // An identical retry replays without new provider calls; a reused key with new content conflicts.
    const before = app.openai.calls.length;
    expect(await (await turn(conversation.id, 0, "t1", voice)).json()).toEqual(afterVoice);
    expect(app.openai.calls.length).toBe(before);
    expect((await turn(conversation.id, 0, "t1", { text: "はい" })).status).toBe(409);
    expect((await (await turn(conversation.id, 0, "t2", { text: "はい" })).json()).error.code).toBe("conflict");
    expect((await (await turn(conversation.id, 2, "t2", { text: "hai" })).json()).error.code).toBe("invalid_script");
    expect((await turn(conversation.id, 2, "t3", { text: "はい", audio: voice.audio })).status).toBe(400);

    const typed = await (await turn(conversation.id, 2, "t3", { text: "はい、 よろしく おねがいします" })).json();
    expect(typed.turns[3]).toMatchObject({ role: "learner", text: "はい、 よろしく おねがいします", input: "text" });

    const audio = await app.request(`/conversations/${conversation.id}/turns/2/audio`);
    expect(audio.status).toBe(200);
    expect(new TextDecoder().decode(await audio.arrayBuffer())).toContain("そうですか。ハルもがくせいです。");
    expect((await app.request(`/conversations/${conversation.id}/turns/1/audio`)).status).toBe(404);

    expect((await app.request(`/conversations/${conversation.id}`, { token: "avc_st_n5other" })).status).toBe(404);
    expect((await turn(conversation.id, 4, "t4", { text: "はい" }, "avc_st_n5other")).status).toBe(404);

    const finished = await (await app.request(`/conversations/${conversation.id}/finish`, { body: {} })).json();
    expect(finished.status).toBe("complete");
    expect(finished.result).toMatchObject({ status: "needs_practice", taskCompletion: 2, targetUse: 2, interaction: 2, spokenTurns: 1, evidence: ["わたしは がくせいです。"], correction: "わたしは がくせいです。" });
    expect(await (await app.request(`/conversations/${conversation.id}/finish`, { body: {} })).json()).toEqual(finished);
    expect((await (await turn(conversation.id, 4, "t5", { text: "はい" })).json()).error.code).toBe("conversation_complete");
    const progress = await (await app.request("/me/progress")).json();
    expect(progress.lessons[0].speaking).toBe("needs_practice");
    const exported = await (await app.request("/me/export")).json();
    expect(exported.conversations).toEqual([finished]);
  });

  it("demonstrates speaking only with three spoken turns and caps the conversation", async () => {
    await enrol("romaji");
    const c = await (await start(2, "cap")).json();
    let seq = 0;
    for (let i = 0; i < 10; i++) {
      const next = await turn(c.id, seq, `cap-${i}`, i < 3 ? voice : { text: "hai" });
      expect(next.status).toBe(200);
      seq += 2;
    }
    expect((await (await turn(c.id, seq, "cap-10", { text: "hai" })).json()).error.code).toBe("turn_limit");
    const done = await (await app.request(`/conversations/${c.id}/finish`, { body: {} })).json();
    expect(done.result).toMatchObject({ status: "demonstrated", spokenTurns: 3 });
    expect(done.turns[1].text).toBe("watashi wa gakusei desu.");
  });

  it("stores nothing when the tutor reply fails validation or the provider fails", async () => {
    await enrol("kana");
    const c = await (await start(3, "bad")).json();
    app.openai.fail.add("bad_reply");
    const bad = await turn(c.id, 0, "bad-1", { text: "はい" });
    expect(bad.status).toBe(503);
    expect((await bad.json()).error.code).toBe("ai_unavailable");
    expect(chatCalls("tutor_turn")).toBe(2);
    app.openai.fail.clear();
    app.openai.fail.add("transcribe");
    expect((await turn(c.id, 0, "bad-2", voice)).status).toBe(503);
    app.openai.fail.clear();
    app.openai.transcript = "";
    expect((await (await turn(c.id, 0, "bad-3", voice)).json()).error.code).toBe("no_speech");
    app.openai.transcript = "わたしは がくせいです";
    expect((await (await app.request(`/conversations/${c.id}`)).json()).turns).toHaveLength(1);
    expect((await turn(c.id, 0, "bad-1", { text: "はい" })).status).toBe(200);
    expect((await (await app.request(`/conversations/${c.id}/finish`, { body: {} })).json()).result.status).toBe("practice_only");
  });

  it("enforces the daily conversation budget and lets learners start over", async () => {
    await enrol("romaji");
    const first = await (await start(4, "budget-0")).json();
    expect((await app.request(`/conversations/${first.id}`, { method: "DELETE" })).status).toBe(200);
    expect((await app.request(`/conversations/${first.id}`)).status).toBe(404);
    for (let unit = 5; unit <= 9; unit++) expect((await start(unit, `budget-${unit}`)).status).toBe(200);
    const over = await start(10, "budget-10");
    expect(over.status).toBe(429);
    expect((await over.json()).error.code).toBe("daily_limit");
  });

  it("cascades conversations, turns, feedback and usage on account deletion", async () => {
    const attempt = await finishedAttempt(7, "romaji", ["nanika", "nanika"]);
    await app.request(`/attempts/${attempt.id}/feedback`, { body: {} });
    const c = await (await start(7, "delete-me")).json();
    await turn(c.id, 0, "delete-turn", { text: "hai" });
    expect((await app.request("/me", { method: "DELETE" })).status).toBe(200);
    for (const table of ["n5_conversations", "n5_turns", "n5_feedback", "n5_usage", "n5_attempts", "n5_accounts"])
      expect((await app.db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n, table).toBe(0);
  });
});

describe("kill switch", () => {
  it("keeps lessons and practice working while every provider call is refused", async () => {
    const off = await runtime({ ai: false });
    try {
      await off.request("/enrolments", { body: { trackId: TRACK_ID, script: "romaji", idempotencyKey: "e" } });
      expect((await off.request(`/lessons/${lessonIdFor(1)}`)).status).toBe(200);
      expect((await (await off.request(`/audio/${LESSONS[0].vocabulary[0].audio}`)).json()).error.code).toBe("audio_unavailable");
      const c = await (await off.request("/conversations", { body: { lessonId: lessonIdFor(1), idempotencyKey: "c" } })).json();
      expect((await (await off.request(`/conversations/${c.id}/turns`, { body: { afterSeq: 0, idempotencyKey: "t", text: "hai" } })).json()).error.code).toBe("ai_unavailable");
      const attempt = await (await off.request("/attempts", { body: { lessonId: lessonIdFor(1), contentVersion: CONTENT_VERSION, idempotencyKey: "a" } })).json();
      await off.request(`/attempts/${attempt.id}/answers`, { body: { revision: 0, idempotencyKey: "s", answers: correctAnswers("romaji").map((a) => (a.questionId.startsWith("w") ? { ...a, value: "nanika" } : a)) } });
      await off.request(`/attempts/${attempt.id}/finish`, { body: { revision: 1 } });
      expect((await (await off.request(`/attempts/${attempt.id}/feedback`, { body: {} })).json()).source).toBe("fallback");
      expect(off.openai.calls).toHaveLength(0);
    } finally { await off.mf.dispose(); }
  });
});
