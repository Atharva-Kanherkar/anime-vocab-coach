import fc from "fast-check";
import { expect, it } from "vitest";
import { parseN5CourseContext } from "../src/lib/n5-course-context";
import { hostedPracticeUrl, isStreamingUrl, parseN5Command, parseN5PilotState, queueObservation } from "../src/lib/n5-pilot";
it("2000 arbitrary payloads never throw at parse boundaries or accept extra command claims", () => {
  fc.assert(fc.property(fc.jsonValue(), value => {
    parseN5PilotState(value); parseN5CourseContext(value); parseN5Command(value);
    expect(parseN5Command({ type: "avc-n5-watch", grade: value })).toBeNull();
  }), { seed: 1752026, numRuns: 2000 });
});
it("2000 arbitrary URLs either fail or stay inside HTTPS provider hosts", () => {
  fc.assert(fc.property(fc.string(), raw => {
    if (isStreamingUrl(raw)) { const u = new URL(raw); expect(u.protocol).toBe("https:"); expect(u.username + u.password + u.port).toBe(""); expect(u.hostname).toMatch(/(^|\.)(youtube\.com|netflix\.com|crunchyroll\.com)$/); }
  }), { seed: 1752027, numRuns: 2000 });
});
it("1000 safe contexts have secret-free owned routes and idempotent immutable observations", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), fc.constantFrom("romaji", "kana"), (n, script) => {
    const context = { courseId: "n5", trackId: "anime", unitId: "u1", episodeId: "e" + n, lessonId: "l" + n, contentVersion: "v1", script };
    const u = new URL(hostedPracticeUrl(context)); expect(u.origin).toBe("https://animevocab.com"); expect([...u.searchParams.keys()]).toEqual(["script"]);
    const event = { episodeId: context.episodeId, contentVersion: "v1", idempotencyKey: "receipt-" + n, observedAt: n };
    const input: typeof event[] = [], queue = queueObservation(input, event);
    expect(input).toEqual([]); expect(queueObservation(queue, { ...event })).toBe(queue); expect(queue).toEqual([event]);
  }), { seed: 1752028, numRuns: 1000 });
});
