import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtime } from "./runtime";
import { correctAnswers } from "./answers";
import { CONTENT_VERSION, COURSE_ID, EPISODE_ID, LESSON_ID, TRACK_ID } from "../src/n5/content";

type Runtime = Awaited<ReturnType<typeof runtime>>;
let app: Runtime;
const enrol = { trackId: TRACK_ID, script: "romaji", idempotencyKey: "enrol" };
const create = { lessonId: LESSON_ID, contentVersion: CONTENT_VERSION, idempotencyKey: "create" };
async function attempt(token?: string) {
  expect((await app.request("/enrolments", { body: enrol, token })).status).toBe(200);
  const response = await app.request("/attempts", { body: create, token });
  expect(response.status).toBe(200);
  return response.json();
}
beforeAll(async () => { app = await runtime(); });
afterEach(async () => { await app.db!.prepare("DELETE FROM n5_accounts").run(); });
afterAll(async () => { await app.mf.dispose(); });

describe("real Worker and D1 end-to-end", () => {
  it.each(["romaji", "kana"])("completes and resumes the %s preview without awarding untested skills", async (script) => {
    const catalog = await app.request("/catalog");
    expect(catalog.status).toBe(200);
    expect(catalog.headers.get("Cache-Control")).toBe("no-store");
    expect((await catalog.json()).tracks).toHaveLength(6);
    const overview = await (await app.request(`/courses/${COURSE_ID}`)).json();
    expect(overview.units).toHaveLength(24);
    expect(overview.availableLessons).toEqual([LESSON_ID]);
    expect((await app.request("/enrolments", { body: { ...enrol, script } })).status).toBe(200);
    const lesson = await (await app.request(`/lessons/${LESSON_ID}`)).json();
    expect(lesson.script).toBe(script);
    expect(JSON.stringify(lesson)).not.toContain("correctOption");
    const event = { episodeId: EPISODE_ID, kind: "watch_complete", idempotencyKey: "watch" };
    const watched = await (await app.request("/events", { body: event })).json();
    expect(await (await app.request("/events", { body: event })).json()).toEqual(watched);
    const fresh = await (await app.request("/attempts", { body: create })).json();
    expect(fresh).toMatchObject({ status: "active", revision: 0, answers: [], result: null, script });
    expect((await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 0 } })).status).toBe(409);
    const snapshot = { revision: 0, idempotencyKey: "answer", answers: correctAnswers(script as "romaji" | "kana") };
    expect(await (await app.request(`/attempts/${fresh.id}/answers`, { body: snapshot })).json()).toEqual({ attemptId: fresh.id, revision: 1 });
    const finished = await (await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 1 } })).json();
    expect(finished).toMatchObject({ status: "complete", revision: 2, script, result: { correct: 8, objectivePercent: 100, mastery: false, production: "needs_review", speaking: "not_assessed", listening: "not_assessed", kanjiLiteracy: "not_assessed" } });
    expect(await (await app.request(`/attempts/${fresh.id}`)).json()).toEqual(finished);
    expect(await (await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 1 } })).json()).toEqual(finished);
    expect((await app.request(`/attempts/${fresh.id}/voice`, { body: {} })).status).toBe(503);
    const progress = await (await app.request("/me/progress")).json();
    expect(progress.mastery).toBe(false);
    expect(progress.observations).toEqual([{ episodeId: EPISODE_ID, kind: "watch_complete" }]);
    expect(progress.attempts).toHaveLength(1);
    const reviews = await (await app.request("/me/reviews")).json();
    expect(reviews.consumerStatus).toBe("not_integrated");
    expect(reviews.events).toHaveLength(8);
    expect(new Set(reviews.events.map((e: { id: string }) => e.id)).size).toBe(8);
    const exported = await (await app.request("/me/export")).json();
    expect(exported.attempts).toEqual([finished]);
    expect(JSON.stringify(exported)).not.toMatch(/fingerprint|pack_hash|mutation_nonce|correctOption/);
    expect((await app.request("/me", { method: "DELETE" })).status).toBe(200);
    for (const table of ["n5_accounts", "n5_enrolments", "n5_events", "n5_attempts", "n5_answer_requests", "n5_review_events"]) expect((await app.db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n).toBe(0);
    expect((await app.request(`/attempts/${fresh.id}`)).status).toBe(404);
    expect((await app.request("/enrolments", { body: { ...enrol, script } })).status).toBe(200);
    expect(await app.kv.get("synctoken:avc_st_n5local:v1")).not.toBeNull();
  });

  it("isolates ownership and derives user IDs only from authenticated token records", async () => {
    const fresh = await attempt();
    for (const action of ["", "/answers", "/finish", "/voice"]) {
      expect((await app.request(`/attempts/${fresh.id}${action}`, { token: "avc_st_n5other", ...(action ? { body: {} } : {}) })).status).toBe(404);
    }
    expect((await app.request("/enrolments", { body: { ...enrol, userId: "n5-other-user" } })).status).toBe(400);
    expect((await (await app.request("/me/export", { token: "avc_st_n5other" })).json()).attempts).toEqual([]);
    await app.request("/me", { method: "DELETE", token: "avc_st_n5other" });
    expect((await app.request(`/attempts/${fresh.id}`)).status).toBe(200);
  });

  it("handles concurrent create, answer CAS, stable replays, finalisation and outbox atomically", async () => {
    await app.request("/enrolments", { body: enrol });
    const creates = await Promise.all(Array.from({ length: 8 }, () => app.request("/attempts", { body: create }).then((r) => r.json())));
    expect(new Set(creates.map((a) => a.id)).size).toBe(1);
    const id = creates[0].id;
    const snapshot = { revision: 0, idempotencyKey: "same", answers: correctAnswers() };
    const saves = await Promise.all(Array.from({ length: 8 }, () => app.request(`/attempts/${id}/answers`, { body: snapshot })));
    expect(saves.map((r) => r.status)).toEqual(Array(8).fill(200));
    expect((await (await app.request(`/attempts/${id}`)).json()).revision).toBe(1);
    const divergent = { ...snapshot, answers: [{ questionId: "greeting", value: "a" }] };
    expect((await app.request(`/attempts/${id}/answers`, { body: divergent })).status).toBe(409);
    expect((await app.request(`/attempts/${id}/answers`, { body: { ...snapshot, idempotencyKey: "stale" } })).status).toBe(409);
    const updated = { ...snapshot, revision: 1, idempotencyKey: "later" };
    expect((await app.request(`/attempts/${id}/answers`, { body: updated })).status).toBe(200);
    expect(await (await app.request(`/attempts/${id}/answers`, { body: snapshot })).json()).toEqual({ attemptId: id, revision: 1 });
    const finishes = await Promise.all(Array.from({ length: 8 }, () => app.request(`/attempts/${id}/finish`, { body: { revision: 2 } }).then((r) => r.json())));
    expect(finishes.every((a) => a.status === "complete" && a.revision === 3)).toBe(true);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_review_events").first())?.n).toBe(8);
    expect((await app.request(`/attempts/${id}/answers`, { body: { ...snapshot, revision: 3, idempotencyKey: "after-finish" } })).status).toBe(409);
  });

  it("one of two different writers wins a revision and failed finalisation cannot enqueue reviews", async () => {
    const fresh = await attempt();
    const writes = await Promise.all(["writer-a", "writer-b"].map((idempotencyKey) => app.request(`/attempts/${fresh.id}/answers`, { body: { revision: 0, idempotencyKey, answers: correctAnswers() } })));
    expect(writes.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 0 } })).status).toBe(409);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_review_events").first())?.n).toBe(0);
    const forged = { revision: 1, correct: 8, mastery: true };
    expect((await app.request(`/attempts/${fresh.id}/finish`, { body: forged })).status).toBe(400);
    await app.db!.prepare("UPDATE n5_attempts SET pack_hash='changed' WHERE id=?").bind(fresh.id).run();
    const stale = await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 1 } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("stale_content");
  });

  it("rolls back finalisation if any review insert fails and enforces database constraints", async () => {
    const fresh = await attempt();
    await app.request(`/attempts/${fresh.id}/answers`, { body: { revision: 0, idempotencyKey: "saved", answers: correctAnswers() } });
    await app.db!.prepare("INSERT INTO n5_review_events(id,user_id,attempt_id,objective_id,judgment) VALUES(?,?,?,?,?)").bind(`${fresh.id}:greeting`, "n5-local-user", fresh.id, "greet", "review-pass").run();
    expect((await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 1 } })).status).toBe(503);
    expect(await (await app.request(`/attempts/${fresh.id}`)).json()).toMatchObject({ status: "active", revision: 1, result: null });
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_review_events").first())?.n).toBe(1);
    await expect(app.db!.prepare("UPDATE n5_attempts SET status='complete' WHERE id=?").bind(fresh.id).run()).rejects.toThrow();
    await expect(app.db!.prepare("UPDATE n5_attempts SET script='kanji' WHERE id=?").bind(fresh.id).run()).rejects.toThrow();
  });

  it("keeps script pinned across enrolment changes and rejects malformed, mixed, duplicated answers", async () => {
    const fresh = await attempt();
    await app.request("/enrolments", { body: { ...enrol, script: "kana", idempotencyKey: "switch" } });
    expect((await (await app.request(`/attempts/${fresh.id}`)).json()).script).toBe("romaji");
    expect((await app.request("/enrolments", { body: { ...enrol, script: "kana" } })).status).toBe(409);
    const bodies = [
      { answers: correctAnswers("kana") },
      { answers: [{ questionId: "missing", value: "a" }] },
      { answers: [{ questionId: "greeting", value: "z" }] },
      { answers: Array(2).fill({ questionId: "greeting", value: "a" }) },
      { answers: correctAnswers(), passed: true },
    ];
    for (const body of bodies) expect((await app.request(`/attempts/${fresh.id}/answers`, { body: { revision: 0, idempotencyKey: "invalid", ...body } })).status).toBe(400);
    expect((await (await app.request(`/attempts/${fresh.id}`)).json()).revision).toBe(0);
    expect((await app.request(`/lessons/${LESSON_ID}?script=romaji-kana`)).status).toBe(400);
    expect((await app.request(`/lessons/${LESSON_ID}?script=kana&script=romaji`)).status).toBe(400);
    expect((await app.request(`/lessons/${LESSON_ID}?userId=other`)).status).toBe(400);
  });

  it("enforces bounded request bodies, methods, versions, origins and attempt limits", async () => {
    expect((await app.request("/catalog", { token: null })).status).toBe(401);
    expect((await app.request("/catalog", { token: "avc_st_nope" })).status).toBe(401);
    expect((await app.request("/catalog", { token: "avc_st_denied" })).status).toBe(404);
    expect((await app.request("/catalog", { headers: { Origin: "https://evil.example" } })).status).toBe(403);
    expect((await app.request("/catalog", { headers: { Origin: "https://animevocab.com" } })).headers.get("Access-Control-Allow-Origin")).toBe("https://animevocab.com");
    expect((await app.request("/catalog", { method: "OPTIONS", token: null })).status).toBe(200);
    const wrongMethod = await app.request("/catalog", { method: "POST" });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("GET");
    expect((await app.request("/me", { method: "DELETE", body: { userId: "other" } })).status).toBe(400);
    expect((await app.request("/catalog?userId=other")).status).toBe(400);
    expect((await app.request("/missing")).status).toBe(404);
    expect((await app.request("/attempts/not-a-uuid")).status).toBe(404);
    expect((await app.request("/enrolments", { raw: "{" })).status).toBe(400);
    expect((await app.request("/enrolments", { body: enrol, headers: { "Content-Type": "text/plain" } })).status).toBe(415);
    expect((await app.request("/enrolments", { raw: "x".repeat(16385) })).status).toBe(413);
    expect((await app.request("/enrolments", { raw: "x".repeat(16384) })).status).toBe(400);
    expect((await app.request("/attempts", { body: create })).status).toBe(409);
    await app.request("/enrolments", { body: enrol });
    expect((await app.request("/attempts", { body: { ...create, contentVersion: "old" } })).status).toBe(400);
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, n) => app.request("/attempts", { body: { ...create, idempotencyKey: `attempt-${n}` } })));
    expect(attempts.filter((r) => r.status === 200)).toHaveLength(5);
    expect(attempts.filter((r) => r.status === 429)).toHaveLength(3);
  });
});

describe("runtime availability and persistence", () => {
  it.each([{ enabled: "0", status: 404 }, { enabled: null, database: false, status: 404 }, { enabled: "true", status: 404 }, { allowed: "", status: 404 }, { allowed: "n5-local-user-other", status: 404 }, { database: false, status: 503 }])("fails closed with $status", async ({ status, ...options }) => {
    const isolated = await runtime(options);
    try {
      expect((await isolated.request("/catalog")).status).toBe(status);
      expect((await isolated.mf.dispatchFetch("http://localhost/v1/public/config")).status).toBe(200);
    } finally { await isolated.mf.dispose(); }
  });
  it("resumes saved attempts after replacing the Worker over the same database", async () => {
    const persist = await mkdtemp(join(tmpdir(), "n5-persist-"));
    let isolated = await runtime({ persist });
    try {
      await isolated.request("/enrolments", { body: enrol });
      const fresh = await (await isolated.request("/attempts", { body: create })).json();
      await isolated.mf.dispose();
      isolated = await runtime({ persist });
      expect(await (await isolated.request(`/attempts/${fresh.id}`)).json()).toEqual(fresh);
    } finally { await isolated.mf.dispose(); await rm(persist, { recursive: true, force: true }); }
  });
});
