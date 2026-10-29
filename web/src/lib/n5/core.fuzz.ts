import { expect, it } from "vitest";
import fc from "fast-check";
import { draftKey, gatewayRoute, restoreDraft, safeLink } from "./core";
import type { N5Attempt, N5Question } from "../../../../shared/n5/contracts";
const attempt: N5Attempt = { id: "11111111-1111-4111-8111-111111111111", courseId: "course", lessonId: "lesson", contentVersion: "v1", script: "romaji", revision: 0, status: "active", answers: [], result: null };
const questions: N5Question[] = [{ id: "write", kind: "production", skill: "writing", objectiveId: "one", prompt: "Write" }];
const options = { seed: 1762026, numRuns: 1000 };
it("arbitrary stored JSON never throws or crosses owner/content/script boundaries", () => {
  fc.assert(fc.property(fc.jsonValue(), (value) => {
    const raw = JSON.stringify(value);
    expect(() => restoreDraft(raw, "alice", attempt, questions)).not.toThrow();
    const d = restoreDraft(raw, "alice", attempt, questions);
    if (d) { expect(d.ownerId).toBe("alice"); expect(d.attemptId).toBe(attempt.id); expect(d.script).toBe("romaji"); expect(d.contentVersion).toBe("v1"); }
  }), options);
});
it("bounded Unicode answers preserve immutable pending identity and reject another account", () => {
  fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 0x10ffff }), { minLength: 1, maxLength: 250 }).map((points) => String.fromCodePoint(...points)), fc.integer({ min: 0, max: 1000000 }), (value, revision) => {
    const answers = [{ questionId: "write", value }];
    const d = { version: 1, ownerId: "alice", attemptId: attempt.id, script: "romaji", contentVersion: "v1", revision, answers, pending: { revision, idempotencyKey: "stable-retry", answers } };
    expect(restoreDraft(JSON.stringify(d), "alice", attempt, questions)).toEqual(d);
    expect(restoreDraft(JSON.stringify(d), "bob", attempt, questions)).toBeNull();
    expect(restoreDraft(JSON.stringify({ ...d, script: "kana" }), "alice", attempt, questions)).toBeNull();
  }), options);
});
it("untrusted route/query text cannot become an upstream URL or cross the gateway prefix", () => {
  fc.assert(fc.property(fc.array(fc.string({ maxLength: 150 }), { maxLength: 8 }), fc.constantFrom("GET", "POST", "DELETE", "PUT"), fc.string(), (parts, method, search) => {
    const route = gatewayRoute(parts, method, new URLSearchParams(search));
    if (route) { expect(route.startsWith("/")).toBe(true); expect(route).not.toMatch(/:|\.\.|\\|\/\//); expect(route).not.toContain("userId"); }
    expect(gatewayRoute(["..", ...parts], method, new URLSearchParams())).toBeNull();
  }), options);
});
it("provider links remain HTTPS and storage scope keys do not collide across owners", () => {
  fc.assert(fc.property(fc.string({ maxLength: 200 }), fc.string({ maxLength: 200 }), (owner, id) => {
    const url = safeLink(owner, "watch");
    if (url) { const u = new URL(url); expect(u.origin).toBe("https://www.crunchyroll.com"); expect(u.pathname.startsWith("/series/")).toBe(true); }
    expect(draftKey(owner + ":", id)).not.toBe(draftKey(owner, ":" + id));
  }), options);
});
it("arbitrary course credential records cannot cross owner or expiry boundaries", async () => {
  const { readN5Credential } = await import("../../../../shared/n5/credential");
  const now = 1_800_000_000_000;
  fc.assert(fc.property(fc.jsonValue(), (value) => {
    const record = readN5Credential(JSON.stringify(value), now, "alice");
    if (record) {
      expect(record.id).toBe("alice");
      expect(Number.isSafeInteger(record.expiresAt)).toBe(true);
      expect(record.expiresAt).toBeGreaterThan(now);
    }
  }), options);
});
