// Reviews done in the cloud app (F6). The web has no copy of the extension's
// storage, so a web review is applied to the stored envelope here AND logged
// as an op. The extension replays the op log on its next sync, which is how a
// review done on the web reaches the vocab the extension actually schedules.
// Pure: the route owns I/O, this owns the SRS and the log.

import type { CloudDailyStats, CloudSyncEnvelope, CloudWordRecord, WebReviewOp } from "./sync";

// Same ladder as the extension (src/types.ts SRS_INTERVALS). Both sides must
// agree, or a word reviewed on the web would come due at a different time than
// the extension would have scheduled it.
export const SRS_INTERVALS = [0, 4 * 3600e3, 24 * 3600e3, 3 * 24 * 3600e3, 7 * 24 * 3600e3, 21 * 24 * 3600e3];
const MAX_STAGE = SRS_INTERVALS.length - 1;

/** The log only has to bridge the gap until the extension's next sync; the
 *  cap keeps a user who never reopens the extension from growing it forever. */
export const MAX_WEB_REVIEWS = 1000;

export type WebReviewResult = "pass" | "fail";
export type WebReviewError = "word_not_found" | "not_due";

export type WebReviewOutcome =
  | { ok: true; envelope: CloudSyncEnvelope; word: CloudWordRecord }
  | { ok: false; error: WebReviewError };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function isWebReviewResult(value: unknown): value is WebReviewResult {
  return value === "pass" || value === "fail";
}

function isDue(word: CloudWordRecord, now: Date): boolean {
  if (word.state !== "learning" || !word.review?.dueAt) return false;
  const due = Date.parse(word.review.dueAt);
  return Number.isFinite(due) && due <= now.getTime();
}

function judgeWord(word: CloudWordRecord, result: WebReviewResult, now: Date): CloudWordRecord {
  const review = word.review!;
  const nowMs = now.getTime();
  // lastSeenAt is what mergeCloudSnapshots uses to pick a winner, so bumping it
  // is what stops the extension's next (pre-replay) push from undoing this.
  const lastSeenAt = now.toISOString();

  if (result === "fail") {
    return {
      ...word,
      lastSeenAt,
      review: { stage: 1, lapses: review.lapses + 1, dueAt: new Date(nowMs + SRS_INTERVALS[1]).toISOString() },
    };
  }

  const stage = review.stage + 1;
  if (stage > MAX_STAGE) return { ...word, lastSeenAt, state: "known", review: null };
  return {
    ...word,
    lastSeenAt,
    review: { ...review, stage, dueAt: new Date(nowMs + SRS_INTERVALS[stage]).toISOString() },
  };
}

function bumpDaily(daily: CloudDailyStats[], day: string): CloudDailyStats[] {
  const existing = daily.find((d) => d.day === day);
  const row: CloudDailyStats = existing
    ? { ...existing, reviews: existing.reviews + 1, judged: existing.judged + 1 }
    : { day, met: 0, judged: 1, reviews: 1, watchMin: 0 };
  return [...daily.filter((d) => d.day !== day), row].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Judge one due word against the stored envelope. `day` is the learner's LOCAL
 * day key, sent by the client, because the extension buckets daily stats by
 * local date and the two must land on the same row.
 */
export function applyWebReview(
  envelope: CloudSyncEnvelope,
  base: string,
  result: WebReviewResult,
  day: string,
  now = new Date()
): WebReviewOutcome {
  const current = envelope.snapshot.words.find((w) => w.base === base);
  if (!current) return { ok: false, error: "word_not_found" };
  if (!isDue(current, now)) return { ok: false, error: "not_due" };

  const word = judgeWord(current, result, now);
  const seq = (envelope.webReviewSeq ?? 0) + 1;
  const op: WebReviewOp = { seq, base, result, at: now.toISOString() };
  const log = [...(envelope.webReviews ?? []), op];

  return {
    ok: true,
    word,
    envelope: {
      ...envelope,
      snapshot: {
        ...envelope.snapshot,
        words: envelope.snapshot.words.map((w) => (w.base === base ? word : w)),
        daily: bumpDaily(envelope.snapshot.daily, day),
      },
      webReviews: log.length > MAX_WEB_REVIEWS ? log.slice(log.length - MAX_WEB_REVIEWS) : log,
      webReviewSeq: seq,
      revision: envelope.revision + 1,
      lastSyncedAt: now.toISOString(),
    },
  };
}

/**
 * Drop the ops the extension has confirmed it replayed (seq <= appliedSeq) and
 * cap what is left, newest kept. webReviewSeq is untouched: it is the counter
 * the next op numbers from, and must never go backwards.
 */
export function pruneWebReviews(envelope: CloudSyncEnvelope, appliedSeq: number | null | undefined): CloudSyncEnvelope {
  const log = envelope.webReviews ?? [];
  const kept = Number.isFinite(appliedSeq) ? log.filter((op) => op.seq > (appliedSeq as number)) : log;
  const capped = kept.length > MAX_WEB_REVIEWS ? kept.slice(kept.length - MAX_WEB_REVIEWS) : kept;
  if (!envelope.webReviews && capped.length === 0) return envelope;
  return { ...envelope, webReviews: capped };
}
