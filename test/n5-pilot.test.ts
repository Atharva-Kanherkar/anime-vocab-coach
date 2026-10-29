import { describe, expect, it } from "vitest";
import { isStreamingUrl, parseN5PilotState, queueObservation, hostedPracticeUrl } from "../src/lib/n5-pilot";
const context = { courseId: "n5-foundations", trackId: "your-lie-in-april-2014", unitId: "unit-1", episodeId: "your-lie-in-april-2014-s1-e1", lessonId: "your-lie-in-april-s1-e1", contentVersion: "preview-1", script: "romaji" };
export const snapshot = { apiVersion: 1, ownerId: "alice", context, lesson: { id: context.lessonId, contentVersion: "preview-1", script: "romaji", canDo: "Introduce yourself", vocabulary: [{ id: "friend", reading: "tomodachi", meaning: "Friend" }], grammar: [] }, watched: false, activeAttempts: [], completedAttempts: 0, mastery: false };
describe("N5 pilot boundaries", () => {
  it("projects bounded server context and rejects mismatched scripts, claims, mixed readings and oversized lists", () => {
    expect(parseN5PilotState(snapshot)).toEqual(snapshot);
    for (const value of [null, {}, { ...snapshot, mastery: true }, { ...snapshot, lesson: { ...snapshot.lesson, script: "kana" } }, { ...snapshot, ownerId: "" }, { ...snapshot, activeAttempts: Array(6).fill({}) }, { ...snapshot, lesson: { ...snapshot.lesson, vocabulary: [{ id: "a", reading: "友tomodachi", meaning: "Friend" }] } }]) expect(parseN5PilotState(value)).toBeNull();
    expect(parseN5PilotState({ ...snapshot, token: "secret", lesson: { ...snapshot.lesson, correctOption: "a" } })).toEqual(snapshot);
  });
  it("allows only exact streaming hosts and safe owned assessment destinations", () => {
    for (const url of ["https://www.youtube.com/watch?v=x", "https://www.netflix.com/watch/1", "https://www.crunchyroll.com/watch/1"]) expect(isStreamingUrl(url)).toBe(true);
    for (const url of ["https://youtube.com.evil.test/watch", "javascript:alert(1)", "https://u:p@www.youtube.com/watch", "http://www.youtube.com/watch", "https://www.youtube.com:444/watch"]) expect(isStreamingUrl(url)).toBe(false);
    expect(hostedPracticeUrl(context as never)).toBe("https://animevocab.com/app/n5/lessons/your-lie-in-april-s1-e1?script=romaji");
    expect(() => hostedPracticeUrl({ ...context, lessonId: "//evil.test" } as never)).toThrow();
  });
  it("keeps stable duplicate event IDs, bounds queues without losing pending work and rejects conflicting IDs", () => {
    const event = { episodeId: context.episodeId, contentVersion: "preview-1", idempotencyKey: "key", observedAt: 1 };
    expect(queueObservation([], event)).toEqual([event]);
    expect(queueObservation([event], event)).toEqual([event]);
    expect(() => queueObservation([event], { ...event, episodeId: "other" })).toThrow();
    const full = Array.from({ length: 100 }, (_, i) => ({ ...event, episodeId: "episode-" + i, idempotencyKey: "key" + i }));
    expect(() => queueObservation(full, event)).toThrow();
    expect(full).toHaveLength(100);
  });
});
