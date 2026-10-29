import { afterAll, beforeAll, expect, it } from "vitest";
import fc from "fast-check";
import { runtime } from "./runtime";
import { CONTENT_VERSION, LESSON_ID, TRACK_ID } from "./answers";
let app: Awaited<ReturnType<typeof runtime>>;
beforeAll(async () => { app = await runtime(); });
afterAll(async () => { await app.mf.dispose(); });
it("100 malformed arbitrary JSON bodies never write course state or return internal failures", async () => {
  await fc.assert(fc.asyncProperty(fc.jsonValue(), async (payload) => {
    // Unknown property makes the shape invalid regardless of the generated payload.
    const response = await app.request("/enrolments", { body: { userId: payload } });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_request");
  }), { seed: 1742026, numRuns: 100 });
  expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_accounts").first())?.n).toBe(0);
});
it("100 adversarial answer payloads cannot advance revision or create grades", async () => {
  await app.request("/enrolments", { body: { trackId: TRACK_ID, script: "romaji", idempotencyKey: "enrol" } });
  const fresh = await (await app.request("/attempts", { body: { lessonId: LESSON_ID, contentVersion: CONTENT_VERSION, idempotencyKey: "create" } })).json();
  await fc.assert(fc.asyncProperty(fc.jsonValue(), async (payload) => {
    const response = await app.request(`/attempts/${fresh.id}/answers`, {
      body: { revision: 0, idempotencyKey: "attack", answers: [{ questionId: "w1", value: payload }], mastery: true },
    });
    expect(response.status).toBe(400);
  }), { seed: 1742027, numRuns: 100 });
  expect(await (await app.request(`/attempts/${fresh.id}`)).json()).toMatchObject({ revision: 0, answers: [], result: null });
  expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_answer_requests").first())?.n).toBe(0);
  expect((await app.db!.prepare("SELECT COUNT(*) AS n FROM n5_review_events").first())?.n).toBe(0);
});
