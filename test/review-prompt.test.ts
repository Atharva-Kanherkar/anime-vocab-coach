import { describe, it, expect } from "vitest";
import type { Stats, VocabMap, VocabRecord } from "../src/types";
import {
  EMPTY_REVIEW_PROMPT,
  REVIEW_PROMPT_MAX_ASKS,
  REVIEW_PROMPT_MIN_MINED,
  REVIEW_PROMPT_SNOOZE_EXTRA_CARDS,
  REVIEW_PROMPT_SNOOZE_MS,
  applyMaybeLater,
  applyNoThanks,
  applyRate,
  applyShown,
  countMinedCards,
  shouldCountShown,
  shouldShowReviewPrompt,
  totalReviewsDone,
} from "../src/lib/review-prompt";
import { isExtensionEvent } from "../src/lib/extension-events";

function rec(partial: Partial<VocabRecord> = {}): VocabRecord {
  return {
    state: "learning",
    reading: "",
    gloss: "",
    level: 5,
    freqRank: 1000,
    seenCount: 1,
    shownCount: 0,
    firstSeenAt: 0,
    lastSeenAt: 0,
    srs: null,
    ...partial,
  };
}

function vocabWithMined(n: number): VocabMap {
  const vocab: VocabMap = {};
  for (let i = 0; i < n; i++) {
    vocab[`w${i}`] = rec({ state: i % 2 === 0 ? "known" : "learning" });
  }
  return vocab;
}

function statsWithReviews(reviews: number): Stats {
  return { daily: { "2026-01-01": { met: 0, judged: 0, reviews, watchMin: 0 } }, cardTimestamps: [] };
}

const NOW = 1_700_000_000_000;

describe("countMinedCards / totalReviewsDone", () => {
  it("counts known + learning only", () => {
    const vocab: VocabMap = {
      a: rec({ state: "known" }),
      b: rec({ state: "learning" }),
      c: rec({ state: "new" }),
      d: rec({ state: "ignored" }),
    };
    expect(countMinedCards(vocab)).toBe(2);
  });

  it("sums daily reviews", () => {
    const stats: Stats = {
      daily: {
        a: { met: 0, judged: 0, reviews: 2, watchMin: 0 },
        b: { met: 0, judged: 0, reviews: 3, watchMin: 0 },
      },
      cardTimestamps: [],
    };
    expect(totalReviewsDone(stats)).toBe(5);
  });
});

describe("shouldShowReviewPrompt", () => {
  it("requires mined cards and at least one review", () => {
    const eligible = {
      vocab: vocabWithMined(REVIEW_PROMPT_MIN_MINED),
      stats: statsWithReviews(1),
      prompt: { ...EMPTY_REVIEW_PROMPT },
      now: NOW,
    };
    expect(shouldShowReviewPrompt(eligible)).toBe(true);
    expect(
      shouldShowReviewPrompt({ ...eligible, vocab: vocabWithMined(REVIEW_PROMPT_MIN_MINED - 1) })
    ).toBe(false);
    expect(shouldShowReviewPrompt({ ...eligible, stats: statsWithReviews(0) })).toBe(false);
  });

  it("respects dismissedForever", () => {
    expect(
      shouldShowReviewPrompt({
        vocab: vocabWithMined(20),
        stats: statsWithReviews(1),
        prompt: { ...EMPTY_REVIEW_PROMPT, dismissedForever: true },
        now: NOW,
      })
    ).toBe(false);
  });

  it("caps at two asks, but keeps remounting the current unanswered ask", () => {
    const vocab = vocabWithMined(20);
    const stats = statsWithReviews(1);
    // After two completed ask cycles (shown twice, then snoozed past max)
    expect(
      shouldShowReviewPrompt({
        vocab,
        stats,
        prompt: {
          ...EMPTY_REVIEW_PROMPT,
          askCount: REVIEW_PROMPT_MAX_ASKS,
          lastShownAt: 0,
          snoozeUntil: NOW + 1,
          snoozeAfterCards: 99,
        },
        now: NOW,
      })
    ).toBe(false);
    // Mid-ask remount: shown once, user has not answered yet
    expect(
      shouldShowReviewPrompt({
        vocab,
        stats,
        prompt: { ...EMPTY_REVIEW_PROMPT, askCount: 1, lastShownAt: NOW - 1000 },
        now: NOW,
      })
    ).toBe(true);
  });

  it("honors snooze until and +20 cards", () => {
    const mined = 15;
    const afterFirstShow = applyShown({ ...EMPTY_REVIEW_PROMPT }, NOW);
    const prompt = applyMaybeLater(afterFirstShow, mined, NOW);
    const base = {
      vocab: vocabWithMined(mined),
      stats: statsWithReviews(1),
      prompt,
      now: NOW,
    };
    // Still within 2 weeks and under card threshold
    expect(shouldShowReviewPrompt(base)).toBe(false);
    // Time passed but not enough cards
    expect(
      shouldShowReviewPrompt({
        ...base,
        now: NOW + REVIEW_PROMPT_SNOOZE_MS + 1,
        vocab: vocabWithMined(mined + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS - 1),
      })
    ).toBe(false);
    // Cards enough but still snoozed
    expect(
      shouldShowReviewPrompt({
        ...base,
        now: NOW + 1000,
        vocab: vocabWithMined(mined + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS),
      })
    ).toBe(false);
    // Both cleared → second ask
    expect(
      shouldShowReviewPrompt({
        ...base,
        now: NOW + REVIEW_PROMPT_SNOOZE_MS + 1,
        vocab: vocabWithMined(mined + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS),
      })
    ).toBe(true);
  });

  it("never shows when blocked (review session / playback)", () => {
    expect(
      shouldShowReviewPrompt({
        vocab: vocabWithMined(20),
        stats: statsWithReviews(1),
        prompt: { ...EMPTY_REVIEW_PROMPT },
        now: NOW,
        blocked: true,
      })
    ).toBe(false);
  });
});

describe("apply* transitions", () => {
  it("applyMaybeLater sets snooze without changing askCount", () => {
    const afterShow = applyShown({ ...EMPTY_REVIEW_PROMPT }, NOW);
    const next = applyMaybeLater(afterShow, 12, NOW);
    expect(next.askCount).toBe(1);
    expect(next.snoozeUntil).toBe(NOW + REVIEW_PROMPT_SNOOZE_MS);
    expect(next.snoozeAfterCards).toBe(12 + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS);
  });

  it("applyNoThanks dismisses forever", () => {
    expect(applyNoThanks({ ...EMPTY_REVIEW_PROMPT }).dismissedForever).toBe(true);
  });

  it("applyRate stops asking", () => {
    const after = applyRate(applyShown({ ...EMPTY_REVIEW_PROMPT }, NOW));
    expect(
      shouldShowReviewPrompt({
        vocab: vocabWithMined(20),
        stats: statsWithReviews(1),
        prompt: after,
        now: NOW,
      })
    ).toBe(false);
  });

  it("applyShown increments askCount and clears snooze", () => {
    const next = applyShown(
      { ...EMPTY_REVIEW_PROMPT, snoozeUntil: NOW - 1, snoozeAfterCards: 30 },
      NOW
    );
    expect(next.lastShownAt).toBe(NOW);
    expect(next.askCount).toBe(1);
    expect(next.snoozeUntil).toBe(0);
    expect(next.snoozeAfterCards).toBe(0);
  });

  it("shouldCountShown fires once per ask, again after snooze clears, never a third", () => {
    expect(shouldCountShown({ ...EMPTY_REVIEW_PROMPT }, NOW)).toBe(true);
    const afterShow = applyShown({ ...EMPTY_REVIEW_PROMPT }, NOW);
    expect(shouldCountShown(afterShow, NOW + 1000)).toBe(false);
    const snoozed = applyMaybeLater(afterShow, 12, NOW + 1000);
    expect(shouldCountShown(snoozed, NOW + 1000)).toBe(false);
    const afterSnooze = NOW + 1000 + REVIEW_PROMPT_SNOOZE_MS + 1;
    expect(shouldCountShown(snoozed, afterSnooze)).toBe(true);
    const second = applyShown(snoozed, afterSnooze);
    expect(second.askCount).toBe(2);
    const snoozedAgain = applyMaybeLater(second, 40, afterSnooze);
    expect(shouldCountShown(snoozedAgain, afterSnooze + REVIEW_PROMPT_SNOOZE_MS + 1)).toBe(false);
  });
});

describe("isExtensionEvent allowlist", () => {
  it("accepts only allowlisted names", () => {
    expect(isExtensionEvent("review_prompt_shown")).toBe(true);
    expect(isExtensionEvent("review_prompt_clicked")).toBe(true);
    expect(isExtensionEvent("upgrade_prompt_shown")).toBe(false);
    expect(isExtensionEvent("")).toBe(false);
    expect(isExtensionEvent(null)).toBe(false);
  });
});
