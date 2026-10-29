import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runtime } from "./runtime";
import { fingerprint } from "../src/n5/domain";
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
  it("accepts bounded N5-only credentials without creating or touching extension links", async () => {
    const token = "avc_n5_" + "a".repeat(64);
    const key = `n5token:${token}:v1`;
    const record = JSON.stringify({ id: "n5-local-user", expiresAt: Date.now() + 300_000 });
    await app.kv.put(key, record);
    expect((await app.request("/catalog", { token })).status).toBe(200);
    expect(await app.kv.get(key)).toBe(record);
    expect(await app.kv.get("synctoken:user:n5-local-user:v1")).toBeNull();
    for (const path of ["/v1/usage", "/v1/session"]) {
      const response = await app.mf.dispatchFetch("http://localhost" + path, {
        method: path.endsWith("session") ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        ...(path.endsWith("session") ? { body: "{}" } : {}),
      });
      expect(response.status).toBe(401);
    }
    const fresh = await attempt(token);
    expect((await app.request(`/attempts/${fresh.id}`, { token: "avc_st_n5other" })).status).toBe(404);
    for (const raw of ["{", "null", JSON.stringify({ id: "n5-local-user", expiresAt: Date.now() - 1 }), JSON.stringify({ id: 1, expiresAt: Date.now() + 300_000 })]) {
      await app.kv.put(key, raw);
      expect((await app.request("/catalog", { token })).status).toBe(401);
    }
    await app.kv.put(key, JSON.stringify({ id: "not-in-preview", expiresAt: Date.now() + 300_000 }));
    expect((await app.request("/catalog", { token })).status).toBe(404);
    await app.kv.delete(key);
    expect((await app.request("/catalog", { token })).status).toBe(401);
  });

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
    expect(progress.attempts).toEqual([{ id: fresh.id, status: "complete", script, result: finished.result }]);
    expect(progress.enrolment).toEqual({ trackId: TRACK_ID, script });
    const reviews = await (await app.request("/me/reviews")).json();
    expect(reviews.consumerStatus).toBe("not_integrated");
    expect(reviews.events).toHaveLength(8);
    expect(new Set(reviews.events.map((e: { id: string }) => e.id)).size).toBe(8);
    const exported = await (await app.request("/me/export")).json();
    expect(exported.attempts).toEqual([finished]);
    expect(exported.enrolments).toEqual([{ trackId: TRACK_ID, script, createdAt: expect.any(Number) }]);
    expect(exported.observations).toEqual([{ episodeId: EPISODE_ID, kind: "watch_complete", createdAt: expect.any(Number) }]);
    expect(exported.reviews).toEqual(reviews.events);
    expect(JSON.stringify(exported)).not.toMatch(/"(track_id|episode_id|created_at|attempt_id|objective_id)"\s*:/);
    expect(JSON.stringify(exported)).not.toMatch(/fingerprint|pack_hash|mutation_nonce|correctOption/);
    expect((await app.request("/me", { method: "DELETE" })).status).toBe(200);
    for (const table of ["n5_accounts", "n5_enrolments", "n5_events", "n5_event_requests", "n5_attempts", "n5_answer_requests", "n5_review_events"]) expect((await app.db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n).toBe(0);
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

describe("PR review regressions", () => {
  it.each([
    ["kana", "はじめまして　ハルです"], ["kana", "ハルです〜"], ["kana", "ハルです…"],
    ["romaji", "Arigatō gozaimasu"], ["romaji", "I’m Haru"],
    ["romaji", "Haru desu “hajimemashite”"], ["kana", "ハル（はる）です"],
    ["kana", "『はる』です"], ["kana", "はる：です"],
  ])("preserves %s keyboard input in snapshots, replays and export", async (script, text) => {
    await app.request("/enrolments", { body: { ...enrol, script } });
    const fresh = await (await app.request("/attempts", { body: create })).json();
    const snapshot = { revision: 0, idempotencyKey: "keyboard", answers: [{ questionId: "write-name", value: text }] };
    const saved = await (await app.request(`/attempts/${fresh.id}/answers`, { body: snapshot })).json();
    expect(saved).toEqual({ attemptId: fresh.id, revision: 1 });
    expect(await (await app.request(`/attempts/${fresh.id}/answers`, { body: snapshot })).json()).toEqual(saved);
    expect((await (await app.request(`/attempts/${fresh.id}`)).json()).answers).toEqual(snapshot.answers);
    expect((await (await app.request("/me/export")).json()).attempts[0].answers).toEqual(snapshot.answers);
    const invalid = await app.request(`/attempts/${fresh.id}/answers`, { body: { ...snapshot, revision: 1, idempotencyKey: "mixed", answers: [{ questionId: "write-name", value: "Haruです" }] } });
    expect(invalid.status).toBe(400);
    const error = await invalid.json();
    expect(error.error).toEqual({ code: "invalid_answers", message: "Answers must match the pinned questions and script.", details: { questionId: "write-name" } });
    expect(JSON.stringify(error)).not.toContain("Haruです");
    expect((await (await app.request(`/attempts/${fresh.id}`)).json()).revision).toBe(1);
  });
  it.each(["pack_hash", "content_version", "lesson_id"])("releases stale %s capacity while preserving history and current-pack bounds", async (column) => {
    const old = await attempt();
    for (let n = 1; n < 5; n++) expect((await app.request("/attempts", { body: { ...create, idempotencyKey: `old-${n}` } })).status).toBe(200);
    await app.db!.prepare(`UPDATE n5_attempts SET ${column}='old'`).run();
    const stale = await app.request(`/attempts/${old.id}/answers`, { body: { revision: 0, idempotencyKey: "stale", answers: correctAnswers() } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error.code).toBe("stale_content");
    const responses = await Promise.all(Array.from({ length: 8 }, (_, n) => app.request("/attempts", { body: { ...create, idempotencyKey: `new-${n}` } })));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 429)).toHaveLength(3);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_attempts").first())?.n).toBe(10);
    expect((await (await app.request("/attempts", { body: create })).json()).id).toBe(old.id);
  });

  it("abandons only owned active attempts including stale packs and cascades receipts", async () => {
    const old = await attempt();
    const unsupported = await app.request(`/attempts/${old.id}`, { method: "POST" });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("Allow")).toBe("GET, DELETE");
    await app.request(`/attempts/${old.id}/answers`, { body: { revision: 0, idempotencyKey: "answer", answers: correctAnswers() } });
    expect((await app.request(`/attempts/${old.id}`, { method: "DELETE", token: "avc_st_n5other" })).status).toBe(404);
    expect((await app.request(`/attempts/${old.id}`, { method: "DELETE", body: {} })).status).toBe(400);
    await app.db!.prepare("UPDATE n5_attempts SET pack_hash='stale' WHERE id=?").bind(old.id).run();
    expect(await (await app.request(`/attempts/${old.id}`, { method: "DELETE" })).json()).toEqual({ deleted: true });
    expect((await app.request(`/attempts/${old.id}`)).status).toBe(404);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_answer_requests").first())?.n).toBe(0);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_enrolments").first())?.n).toBe(1);
    const fresh = await attempt();
    await app.request(`/attempts/${fresh.id}/answers`, { body: { revision: 0, idempotencyKey: "answer", answers: correctAnswers() } });
    expect((await app.request(`/attempts/${fresh.id}/finish`, { body: { revision: 1 } })).status).toBe(200);
    expect((await app.request(`/attempts/${fresh.id}`, { method: "DELETE" })).status).toBe(409);
    expect((await (await app.request("/me/reviews")).json()).events).toHaveLength(8);
  });

  it.each(["answers", "finish"])("keeps abandon/%s races atomic", async (action) => {
    const fresh = await attempt();
    await app.request(`/attempts/${fresh.id}/answers`, { body: { revision: 0, idempotencyKey: "saved", answers: correctAnswers() } });
    const [deleted, mutation] = await Promise.all([
      app.request(`/attempts/${fresh.id}`, { method: "DELETE" }),
      app.request(`/attempts/${fresh.id}/${action}`, { body: action === "finish" ? { revision: 1 } : { revision: 1, idempotencyKey: "race", answers: correctAnswers() } }),
    ]);
    expect([200, 409]).toContain(deleted.status);
    expect([200, 404, 409]).toContain(mutation.status);
    const stored = await app.request(`/attempts/${fresh.id}`);
    if (deleted.status === 200) {
      expect(stored.status).toBe(404);
      for (const table of ["n5_answer_requests", "n5_review_events"]) expect((await app.db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n).toBe(0);
    } else {
      expect(await stored.json()).toMatchObject({ status: "complete" });
      expect((await (await app.request("/me/reviews")).json()).events).toHaveLength(8);
    }
  });

  it("rolls enrolment history without blocking script changes or changing pinned attempts", async () => {
    const original = await attempt();
    await app.db!.prepare(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<98)
      INSERT INTO n5_enrolments(user_id,request_key,fingerprint,track_id,script,created_at)
      SELECT 'n5-local-user','seed-'||x,'seed',?,'romaji',x FROM n`).bind(TRACK_ID).run();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, n) => app.request("/enrolments", { body: { ...enrol, idempotencyKey: `repeat-${n}` } })));
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (let n = 0; n < 105; n++) expect((await app.request("/enrolments", { body: { ...enrol, script: n % 2 ? "kana" : "romaji", idempotencyKey: `change-${n}` } })).status).toBe(200);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_enrolments").first())?.n).toBe(100);
    expect((await app.request("/enrolments", { body: { ...enrol, idempotencyKey: "change-104" } })).status).toBe(200);
    expect((await app.request("/enrolments", { body: { ...enrol, script: "kana", idempotencyKey: "change-104" } })).status).toBe(409);
    await app.request("/enrolments", { body: { ...enrol, script: "kana", idempotencyKey: "current" } });
    // A retained old receipt returns its original value without resetting the preference.
    expect(await (await app.request("/enrolments", { body: { ...enrol, idempotencyKey: "change-104" } })).json()).toEqual({ trackId: TRACK_ID, script: "romaji" });
    expect((await (await app.request("/me/progress")).json()).enrolment.script).toBe("kana");
    expect((await (await app.request(`/attempts/${original.id}`)).json()).script).toBe("romaji");
    // Keys outside the documented rolling window become new requests.
    expect((await app.request("/enrolments", { body: { ...enrol, script: "kana" } })).status).toBe(200);
    expect((await app.request("/enrolments", { body: enrol, token: "avc_st_n5other" })).status).toBe(200);
  });

  it("deduplicates episode observations and evicts receipts without losing progress", async () => {
    await app.request("/enrolments", { body: enrol });
    const event = { episodeId: EPISODE_ID, kind: "watch_complete", idempotencyKey: "watch" };
    const watched = await (await app.request("/events", { body: event })).json();
    await app.db!.prepare(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<999)
      INSERT INTO n5_event_requests(id,user_id,request_key,fingerprint,episode_id,kind,created_at,response_id)
      SELECT 'request-'||x,'n5-local-user','seed-'||x,'seed',?,'watch_complete',x,? FROM n`).bind(EPISODE_ID, watched.id).run();
    const responses = await Promise.all(Array.from({ length: 8 }, (_, n) => app.request("/events", { body: { ...event, idempotencyKey: `repeat-${n}` } })));
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
    for (const r of responses) expect(await r.json()).toEqual(watched);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_events").first())?.n).toBe(1);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_event_requests").first())?.n).toBe(1000);
    expect((await app.request("/events", { body: { ...event, kind: "practice_complete", idempotencyKey: "repeat-0" } })).status).toBe(409);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_events").first())?.n).toBe(1);
    expect((await app.request("/events", { body: { ...event, kind: "practice_complete", idempotencyKey: "new-kind" } })).status).toBe(200);
    expect(await (await app.request("/events", { body: event })).json()).toEqual(watched);
    expect((await (await app.request("/me/progress")).json()).observations).toEqual([
      { episodeId: EPISODE_ID, kind: "practice_complete" }, { episodeId: EPISODE_ID, kind: "watch_complete" },
    ]);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_event_requests").first())?.n).toBe(1000);
    await app.request("/enrolments", { body: enrol, token: "avc_st_n5other" });
    const other = await (await app.request("/events", { body: event, token: "avc_st_n5other" })).json();
    expect(other.id).not.toBe(watched.id);
  });

  it("conflicting concurrent event keys cannot record the losing observation", async () => {
    await app.request("/enrolments", { body: enrol });
    const responses = await Promise.all(["watch_complete", "practice_complete"].map((kind) => app.request("/events", { body: { episodeId: EPISODE_ID, kind, idempotencyKey: "competing" } })));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_event_requests").first())?.n).toBe(1);
    expect((await (await app.request("/me/progress")).json()).observations).toHaveLength(1);
  });
});


describe("observation receipt migration", () => {
  it("upgrades legacy duplicates without losing observations, receipts, preferences or attempts", async () => {
    const persist = await mkdtemp(join(tmpdir(), "n5-upgrade-"));
    let isolated = await runtime({ persist, migrationCount: 1 });
    const retained = { episodeId: EPISODE_ID, kind: "watch_complete", idempotencyKey: "retained" };
    try {
      await isolated.request("/enrolments", { body: enrol });
      const original = await (await isolated.request("/attempts", { body: create })).json();
      await isolated.db!.prepare(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1004)
        INSERT INTO n5_events(id,user_id,request_key,fingerprint,episode_id,kind,created_at)
        SELECT 'old-'||x,'n5-local-user','old-'||x,'seed',?,'watch_complete',x FROM n`).bind(EPISODE_ID).run();
      await isolated.db!.prepare("INSERT INTO n5_events(id,user_id,request_key,fingerprint,episode_id,kind,created_at) VALUES('other-episode','n5-local-user','other','seed','legacy-episode','watch_complete',0)").run();
      await isolated.db!.prepare("INSERT INTO n5_events(id,user_id,request_key,fingerprint,episode_id,kind,created_at) VALUES('recent','n5-local-user',?,?,?,'watch_complete',1005)").bind(retained.idempotencyKey, await fingerprint(retained), EPISODE_ID).run();
      await isolated.mf.dispose();
      isolated = await runtime({ persist });
      expect((await isolated.db!.prepare("SELECT COUNT(*) AS n FROM d1_migrations").first())?.n).toBe(2);
      expect((await isolated.db!.prepare("SELECT COUNT(*) AS n FROM n5_event_requests").first())?.n).toBe(1000);
      expect((await isolated.db!.prepare("SELECT COUNT(*) AS n FROM n5_events").first())?.n).toBe(2);
      expect(await (await isolated.request("/events", { body: retained })).json()).toEqual({ id: "recent" });
      expect(await (await isolated.request("/events", { body: { ...retained, idempotencyKey: "canonical" } })).json()).toEqual({ id: "old-1" });
      expect((await isolated.request("/events", { body: { ...retained, kind: "practice_complete" } })).status).toBe(409);
      expect(await (await isolated.request(`/attempts/${original.id}`)).json()).toEqual(original);
      expect((await (await isolated.request("/me/progress")).json()).observations).toHaveLength(2);
      await isolated.mf.dispose();
      isolated = await runtime({ persist });
      expect((await isolated.db!.prepare("SELECT COUNT(*) AS n FROM n5_events").first())?.n).toBe(2);
      expect((await isolated.request("/events", { body: { ...retained, kind: "practice_complete", idempotencyKey: "new" } })).status).toBe(200);
      await isolated.request("/me", { method: "DELETE" });
      for (const table of ["n5_events", "n5_event_requests", "n5_enrolments", "n5_attempts"]) expect((await isolated.db!.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first())?.n).toBe(0);
    } finally { await isolated.mf.dispose(); await rm(persist, { recursive: true, force: true }); }
  });
});
