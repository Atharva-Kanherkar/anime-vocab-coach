import { describe, expect, it } from "vitest";
import {
  applyCloudSyncUpdate,
  createCloudSyncEnvelope,
  mergeCloudSnapshots,
  normalizeAnimeVocabExport,
  type CloudSyncEnvelope,
  type ExtensionVocabRecord,
  type WebReviewOp,
} from "./sync";
import { applyWebReview, isDayKey, MAX_WEB_REVIEWS, pruneWebReviews, SRS_INTERVALS } from "./web-review";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const HOUR = 3600e3;
const profile = { id: "u", email: null, name: null };

function vocab(overrides: Partial<ExtensionVocabRecord> = {}): Partial<ExtensionVocabRecord> {
  return {
    state: "learning",
    reading: "たべる",
    gloss: "to eat",
    level: 5,
    freqRank: 100,
    seenCount: 3,
    shownCount: 2,
    firstSeenAt: NOW.getTime() - 10 * 24 * HOUR,
    lastSeenAt: NOW.getTime() - 2 * 24 * HOUR,
    srs: { stage: 2, dueAt: NOW.getTime() - HOUR, lapses: 0 },
    ...overrides,
  };
}

function snap(words: Record<string, Partial<ExtensionVocabRecord>>, daily: Record<string, object> = {}) {
  return normalizeAnimeVocabExport({ vocab: words, stats: { daily, cardTimestamps: [] } }, new Date(NOW.getTime() - 24 * HOUR));
}

function envelope(words: Record<string, Partial<ExtensionVocabRecord>>, extra: Partial<CloudSyncEnvelope> = {}): CloudSyncEnvelope {
  return { ...createCloudSyncEnvelope(profile, snap(words), 7, new Date(NOW.getTime() - HOUR)), ...extra };
}

function ok(outcome: ReturnType<typeof applyWebReview>) {
  if (!outcome.ok) throw new Error(`expected ok, got ${outcome.error}`);
  return outcome;
}

describe("applyWebReview", () => {
  it("pass advances the stage and schedules the next interval", () => {
    const { word } = ok(applyWebReview(envelope({ 食べる: vocab() }), "食べる", "pass", "2026-09-25", NOW));
    expect(word.state).toBe("learning");
    expect(word.review).toEqual({
      stage: 3,
      lapses: 0,
      dueAt: new Date(NOW.getTime() + SRS_INTERVALS[3]).toISOString(),
    });
  });

  it("a pass at stage 5 graduates the word to known", () => {
    const env = envelope({ 食べる: vocab({ srs: { stage: 5, dueAt: NOW.getTime() - HOUR, lapses: 2 } }) });
    const { word } = ok(applyWebReview(env, "食べる", "pass", "2026-09-25", NOW));
    expect(word.state).toBe("known");
    expect(word.review).toBeNull();
  });

  it("fail resets to stage 1, counts a lapse, and comes back in 4h", () => {
    const env = envelope({ 食べる: vocab({ srs: { stage: 4, dueAt: NOW.getTime() - HOUR, lapses: 1 } }) });
    const { word } = ok(applyWebReview(env, "食べる", "fail", "2026-09-25", NOW));
    expect(word.review).toEqual({ stage: 1, lapses: 2, dueAt: new Date(NOW.getTime() + 4 * HOUR).toISOString() });
    expect(word.state).toBe("learning");
  });

  it("refuses words that are not due", () => {
    const env = envelope({
      future: vocab({ srs: { stage: 2, dueAt: NOW.getTime() + HOUR, lapses: 0 } }),
      known: vocab({ state: "known", srs: null }),
      noReview: vocab({ srs: null }),
      newWord: vocab({ state: "new", srs: { stage: 1, dueAt: NOW.getTime() - HOUR, lapses: 0 } }),
    });
    for (const base of ["future", "known", "noReview", "newWord"]) {
      expect(applyWebReview(env, base, "pass", "2026-09-25", NOW)).toEqual({ ok: false, error: "not_due" });
    }
  });

  it("reports a word the snapshot does not have", () => {
    expect(applyWebReview(envelope({ 食べる: vocab() }), "見る", "pass", "2026-09-25", NOW)).toEqual({
      ok: false,
      error: "word_not_found",
    });
  });

  it("bumps lastSeenAt, the day's counters, the op log and the revision", () => {
    const env = {
      ...createCloudSyncEnvelope(
        profile,
        snap({ 食べる: vocab() }, { "2026-09-25": { met: 4, judged: 2, reviews: 1, watchMin: 12 } }),
        7,
        new Date(NOW.getTime() - HOUR)
      ),
      webReviewSeq: 41,
      webReviews: [{ seq: 41, base: "見る", result: "fail" as const, at: "2026-09-25T10:00:00.000Z" }],
    };
    const { envelope: next, word } = ok(applyWebReview(env, "食べる", "pass", "2026-09-25", NOW));

    expect(word.lastSeenAt).toBe(NOW.toISOString());
    expect(next.snapshot.daily).toEqual([{ day: "2026-09-25", met: 4, judged: 3, reviews: 2, watchMin: 12 }]);
    expect(next.webReviewSeq).toBe(42);
    expect(next.webReviews).toEqual([
      env.webReviews[0],
      { seq: 42, base: "食べる", result: "pass", at: NOW.toISOString() },
    ]);
    expect(next.revision).toBe(8);
    expect(next.lastSyncedAt).toBe(NOW.toISOString());
    // The input envelope is not mutated.
    expect(env.revision).toBe(7);
    expect(env.webReviews).toHaveLength(1);
  });

  it("creates the day row and starts the seq at 1 on a legacy envelope", () => {
    const { envelope: next } = ok(applyWebReview(envelope({ 食べる: vocab() }), "食べる", "fail", "2026-09-26", NOW));
    expect(next.snapshot.daily).toEqual([{ day: "2026-09-26", met: 0, judged: 1, reviews: 1, watchMin: 0 }]);
    expect(next.webReviews?.map((op) => op.seq)).toEqual([1]);
    expect(next.webReviewSeq).toBe(1);
  });
});

describe("pruneWebReviews", () => {
  const ops = (from: number, to: number): WebReviewOp[] =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      seq: from + i,
      base: `w${from + i}`,
      result: "pass" as const,
      at: NOW.toISOString(),
    }));

  it("drops every op the extension has applied", () => {
    const env = envelope({}, { webReviews: ops(1, 5), webReviewSeq: 5 });
    const next = pruneWebReviews(env, 3);
    expect(next.webReviews?.map((op) => op.seq)).toEqual([4, 5]);
    expect(next.webReviewSeq).toBe(5);
  });

  it("caps the log at 1000, keeping the newest", () => {
    const env = envelope({}, { webReviews: ops(1, 1200), webReviewSeq: 1200 });
    const next = pruneWebReviews(env, 0);
    expect(next.webReviews).toHaveLength(MAX_WEB_REVIEWS);
    expect(next.webReviews?.[0].seq).toBe(201);
    expect(next.webReviews?.at(-1)?.seq).toBe(1200);
  });

  it("keeps the log when no seq is given", () => {
    const env = envelope({}, { webReviews: ops(1, 3), webReviewSeq: 3 });
    expect(pruneWebReviews(env, undefined).webReviews).toHaveLength(3);
  });
});

describe("web review and extension pushes", () => {
  it("a stale extension push does not revert a web review", () => {
    const stored = ok(applyWebReview(envelope({ 食べる: vocab() }), "食べる", "pass", "2026-09-25", NOW)).envelope;
    // The extension has not pulled yet: same word, still stage 2, older lastSeenAt.
    const stalePush = snap({ 食べる: vocab() });
    const merged = mergeCloudSnapshots(stored.snapshot, stalePush);
    const word = merged.words.find((w) => w.base === "食べる")!;
    expect(word.review?.stage).toBe(3);
    expect(word.lastSeenAt).toBe(NOW.toISOString());
  });

  it("a normal PUT carries the op log and seq forward", () => {
    const stored = ok(applyWebReview(envelope({ 食べる: vocab() }), "食べる", "pass", "2026-09-25", NOW)).envelope;
    const next = applyCloudSyncUpdate(stored, profile, snap({ 見る: vocab() }), stored.revision, NOW);
    if ("type" in next) throw new Error("expected a merge, got a conflict");
    expect(next.webReviews).toEqual(stored.webReviews);
    expect(next.webReviewSeq).toBe(1);
    expect(next.snapshot.words.find((w) => w.base === "食べる")?.review?.stage).toBe(3);
  });

  it("a PUT with appliedWebReviewSeq retires the replayed ops, without it the log stays", () => {
    const stored = ok(applyWebReview(envelope({ 食べる: vocab() }), "食べる", "pass", "2026-09-25", NOW)).envelope;
    const next = applyCloudSyncUpdate(stored, profile, snap({}), stored.revision, NOW);
    if ("type" in next) throw new Error("expected a merge, got a conflict");
    expect(pruneWebReviews(next, 1).webReviews).toEqual([]);
    expect(pruneWebReviews(next, 1).webReviewSeq).toBe(1);
    expect(next.webReviews).toHaveLength(1);
  });
});

describe("isDayKey", () => {
  it("accepts YYYY-MM-DD only", () => {
    expect(isDayKey("2026-09-25")).toBe(true);
    expect(isDayKey("2026-9-25")).toBe(false);
    expect(isDayKey("2026-13-45")).toBe(false);
    expect(isDayKey(20260925)).toBe(false);
  });
});
