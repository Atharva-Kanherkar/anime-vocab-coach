import { describe, expect, it } from "vitest";
import { parseN5CourseContext } from "../src/lib/n5-course-context";
import { hostedPracticeUrl, isStreamingUrl, parseN5Command, parseN5PilotState, pureReading, queueObservation } from "../src/lib/n5-pilot";
const context = { courseId: "n5", trackId: "anime", unitId: "u1", episodeId: "e1", lessonId: "l1", contentVersion: "v1", script: "romaji" as const };
const lesson = { id: "l1", contentVersion: "v1", script: "romaji", canDo: "Say hello", vocabulary: [{ id: "hello", reading: "konnichiwa", meaning: "Hello" }], grammar: [{ id: "g", example: "watashi wa…", explanation: "Introduce yourself" }] };
const good = () => ({ apiVersion: 1, ownerId: "owner", context, lesson: { ...lesson, grammar: [{ id: "g", example: "watashi wa", explanation: "Introduce yourself" }] }, watched: false, activeAttempts: [{ id: "12345678-1234-4123-8123-123456789abc", script: "romaji" }], completedAttempts: 0, mastery: false });
describe("N5 trust boundary edge cases", () => {
  it("accepts only absolute HTTPS provider hosts without credentials or custom ports", () => {
    for (const host of ["youtube.com", "sub.youtube.com", "netflix.com", "crunchyroll.com"]) expect(isStreamingUrl("https://" + host + "/watch/1")).toBe(true);
    for (const url of ["x", "/watch/1", "https://evil.test", "https://notyoutube.com", "https://youtube.com.evil.test", "http://youtube.com", "https://name@youtube.com", "https://:password@youtube.com", "https://youtube.com:4000", "ftp://netflix.com"]) expect(isStreamingUrl(url)).toBe(false);
  });
  it("enforces pure scripts and bounded nonempty teaching strings", () => {
    for (const text of ["watashi wa", "Ōsaka", "yūki", "x".repeat(500)]) expect(pureReading(text, "romaji")).toBe(true);
    for (const text of ["わたし は", "コーヒー。", "あ".repeat(500), "あした がっこうに いく？", "ほんとう！", "わたし　は"]) expect(pureReading(text, "kana")).toBe(true);
    for (const text of [null, 1, "", "x".repeat(501), "123", "友だち", "romajiかな", "<>script"]) expect(pureReading(text, "romaji")).toBe(false);
    for (const text of [null, "", "あ".repeat(501), "  。", "友達", "kana", "あx"]) expect(pureReading(text, "kana")).toBe(false);
  });
  it("rejects any invalid identifier and accepts the exact maximum length", () => {
    for (const key of Object.keys(context).filter(k => k !== "script")) {
      for (const value of ["", "a".repeat(129), "../x", "x?token=secret", "x_y", "-x", "A", 2, null]) expect(parseN5CourseContext({ ...context, [key]: value })).toBeNull();
      expect(parseN5CourseContext({ ...context, [key]: "a".repeat(128) })).not.toBeNull();
    }
  });
  it("validates all snapshot counters, relationships, list bounds and projected fields", () => {
    expect(parseN5PilotState(good())).toEqual(good());
    expect(parseN5PilotState({ ...good(), context: null, lesson: null })).not.toBeNull();
    for (const [key, values] of Object.entries({ apiVersion: [0, "1"], ownerId: ["", 3, "x".repeat(129)], watched: [0, null], completedAttempts: [-1, .5, NaN, Number.MAX_SAFE_INTEGER + 1], mastery: [true, null], context: [{}, []], lesson: [null, {}, []], activeAttempts: [null, {}, Array(6).fill(good().activeAttempts[0])] })) {
      for (const value of values) expect(parseN5PilotState({ ...good(), [key]: value })).toBeNull();
    }
    expect(parseN5PilotState({ ...good(), completedAttempts: Number.MAX_SAFE_INTEGER })).not.toBeNull();
    expect(parseN5PilotState({ ...good(), ownerId: "x".repeat(128) })).not.toBeNull();
    expect(parseN5PilotState({ ...good(), context: null })).toBeNull();
    for (const [key, value] of Object.entries({ id: "other", script: "kana", contentVersion: "v2", canDo: "", vocabulary: {}, grammar: {} })) expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, [key]: value } })).toBeNull();
    for (const [key, max] of [["vocabulary", 20], ["grammar", 10]] as const) {
      const item = good().lesson[key][0];
      expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, [key]: Array(max).fill(item) } })).not.toBeNull();
      expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, [key]: Array(max + 1).fill(item) } })).toBeNull();
      for (const invalid of [null, {}, { ...item, id: "" }, { ...item, id: "x".repeat(129) }]) expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, [key]: [invalid] } })).toBeNull();
    }
    for (const [key, value] of Object.entries({ reading: "かな", meaning: "", id: 4 })) expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, vocabulary: [{ ...lesson.vocabulary[0], [key]: value }] } })).toBeNull();
    for (const [key, value] of Object.entries({ example: "かな", explanation: "", id: 4 })) expect(parseN5PilotState({ ...good(), lesson: { ...good().lesson, grammar: [{ ...good().lesson.grammar[0], [key]: value }] } })).toBeNull();
    for (const attempt of [null, {}, { id: "oops", script: "kana" }, { ...good().activeAttempts[0], script: "mixed" }]) expect(parseN5PilotState({ ...good(), activeAttempts: [attempt] })).toBeNull();
    expect(parseN5PilotState({ ...good(), activeAttempts: Array(5).fill({ ...good().activeAttempts[0], script: "kana" }) })?.activeAttempts).toHaveLength(5);
    const projected = parseN5PilotState({ ...good(), token: "private", lesson: { ...good().lesson, answer: "private", vocabulary: [{ ...lesson.vocabulary[0], secret: "private" }] } });
    expect(JSON.stringify(projected)).not.toContain("private");
  });
  it("rejects extra command fields, malformed values, unknown types and missing required inputs", () => {
    for (const value of [null, [], {}, { type: 3 }, { type: "nope" }, { type: "__proto__" }, { type: "avc-n5-state", grade: 100 }, { type: "avc-n5-state", refresh: 1 }, { type: "avc-n5-attach" }, { type: "avc-n5-attach", tabId: 0 }, { type: "avc-n5-attach", tabId: .5 }, { type: "avc-n5-attach", tabId: "7" }, { type: "avc-n5-attach", tabId: 7, confirmJapanese: 1 }, { type: "avc-n5-enrol" }, { type: "avc-n5-enrol", script: "mixed" }]) expect(parseN5Command(value)).toBeNull();
    for (const command of [{ type: "avc-n5-state", refresh: true }, { type: "avc-n5-state", refresh: false }, { type: "avc-n5-enrol", script: "kana" }, { type: "avc-n5-enrol", script: "romaji" }, { type: "avc-n5-attach", tabId: 7, confirmJapanese: true }, { type: "avc-n5-attach", tabId: 7, confirmJapanese: false }, ...["watch", "start-assessment", "detach"].map(x => ({ type: "avc-n5-" + x, tabId: 7 })), ...["session", "invalidated", "refresh"].map(x => ({ type: "avc-n5-" + x }))]) expect(parseN5Command(command)).toEqual(command);
  });
  it("uses one owned route and validates attempt IDs", () => {
    expect(hostedPracticeUrl(context)).toBe("https://animevocab.com/app/n5/lessons/l1?script=romaji");
    expect(hostedPracticeUrl({ ...context, script: "kana" })).toContain("?script=kana");
    expect(hostedPracticeUrl(context, good().activeAttempts[0].id)).toBe("https://animevocab.com/app/n5/attempts/12345678-1234-4123-8123-123456789abc");
    for (const id of ["", "../bad", "12345678-1234-3123-8123-123456789abc", "12345678-1234-4123-0123-123456789abc"]) expect(() => hostedPracticeUrl(context, id)).toThrow();
  });
  it("validates receipts and preserves original queue identity on retries and coalescing", () => {
    const event = { episodeId: "e1", contentVersion: "v1", idempotencyKey: "key", observedAt: 1 };
    const queue = [event];
    expect(queueObservation(queue, { ...event })).toBe(queue);
    expect(queueObservation(queue, { ...event, idempotencyKey: "new", observedAt: 2 })).toBe(queue);
    expect(queueObservation(queue, { ...event, episodeId: "e2", idempotencyKey: "new" })).toHaveLength(2);
    expect(queue).toEqual([event]);
    for (const [key, values] of Object.entries({ episodeId: ["", "../x", "a".repeat(129)], contentVersion: ["", "../x", "a".repeat(129)], idempotencyKey: ["", "a".repeat(101), "bad/key"], observedAt: [0, -1, .5, NaN, Number.MAX_SAFE_INTEGER + 1] })) for (const value of values) expect(() => queueObservation([], { ...event, [key]: value })).toThrow();
    expect(queueObservation([], { ...event, idempotencyKey: "a".repeat(100), observedAt: Number.MAX_SAFE_INTEGER })).toHaveLength(1);
    const full = Array.from({ length: 99 }, (_, i) => ({ ...event, episodeId: "episode-" + i, idempotencyKey: "key" + i }));
    expect(queueObservation(full, event)).toHaveLength(100);
  });
});
