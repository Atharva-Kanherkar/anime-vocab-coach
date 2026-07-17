import type { Stats, VocabMap } from "../types";

/** Chrome Web Store reviews deep-link for AnimeVocab. */
export const CWS_REVIEWS_URL =
  "https://chromewebstore.google.com/detail/lkjbomofgfonjjbemobacegffepbdnel/reviews";

export const REVIEW_PROMPT_MIN_MINED = 10;
export const REVIEW_PROMPT_MAX_ASKS = 2;
export const REVIEW_PROMPT_SNOOZE_MS = 14 * 24 * 3600e3;
export const REVIEW_PROMPT_SNOOZE_EXTRA_CARDS = 20;

export interface ReviewPromptState {
  dismissedForever: boolean;
  askCount: number;
  /** Epoch ms; 0 means not snoozed. */
  snoozeUntil: number;
  /** Mined-card threshold that must be reached after a snooze. 0 = none. */
  snoozeAfterCards: number;
  lastShownAt: number;
}

export const EMPTY_REVIEW_PROMPT: ReviewPromptState = {
  dismissedForever: false,
  askCount: 0,
  snoozeUntil: 0,
  snoozeAfterCards: 0,
  lastShownAt: 0,
};

export function countMinedCards(vocab: VocabMap): number {
  let n = 0;
  for (const rec of Object.values(vocab)) {
    if (rec.state === "known" || rec.state === "learning") n++;
  }
  return n;
}

export function totalReviewsDone(stats: Stats): number {
  let n = 0;
  for (const day of Object.values(stats.daily || {})) {
    n += day.reviews || 0;
  }
  return n;
}

export function normalizeReviewPrompt(raw: unknown): ReviewPromptState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_REVIEW_PROMPT };
  const o = raw as Partial<ReviewPromptState>;
  return {
    dismissedForever: !!o.dismissedForever,
    askCount: Math.max(0, Number(o.askCount) || 0),
    snoozeUntil: Math.max(0, Number(o.snoozeUntil) || 0),
    snoozeAfterCards: Math.max(0, Number(o.snoozeAfterCards) || 0),
    lastShownAt: Math.max(0, Number(o.lastShownAt) || 0),
  };
}

export interface ReviewPromptEligibilityInput {
  vocab: VocabMap;
  stats: Stats;
  prompt: ReviewPromptState;
  now?: number;
  /** When true (active review session / playback), never show. */
  blocked?: boolean;
}

export function shouldShowReviewPrompt(input: ReviewPromptEligibilityInput): boolean {
  const now = input.now ?? Date.now();
  if (input.blocked) return false;

  const { prompt } = input;
  if (prompt.dismissedForever) return false;

  const mined = countMinedCards(input.vocab);
  if (mined < REVIEW_PROMPT_MIN_MINED) return false;
  if (totalReviewsDone(input.stats) < 1) return false;

  // Remount of the same unanswered ask (popup closed/reopened).
  const awaitingResponse =
    prompt.lastShownAt > 0 &&
    prompt.snoozeUntil === 0 &&
    prompt.askCount > 0 &&
    prompt.askCount <= REVIEW_PROMPT_MAX_ASKS;
  if (awaitingResponse) return true;

  if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
  if (prompt.snoozeUntil > 0 && now < prompt.snoozeUntil) return false;
  if (prompt.snoozeAfterCards > 0 && mined < prompt.snoozeAfterCards) return false;

  return true;
}

/**
 * Record a new ask display. Increments askCount (max 2 asks per install).
 * Clears snooze so remounts of this ask stay visible until the user acts.
 */
export function applyShown(prompt: ReviewPromptState, now = Date.now()): ReviewPromptState {
  return {
    ...prompt,
    lastShownAt: now,
    askCount: prompt.askCount + 1,
    snoozeUntil: 0,
    snoozeAfterCards: 0,
  };
}

/** True when this mount should count as a new `review_prompt_shown` (not a remount of the same ask). */
export function shouldCountShown(prompt: ReviewPromptState, now = Date.now()): boolean {
  if (prompt.askCount >= REVIEW_PROMPT_MAX_ASKS) return false;
  if (prompt.lastShownAt === 0) return true;
  // Previous ask was snoozed; snooze has cleared → next ask.
  return prompt.snoozeUntil > 0 && now >= prompt.snoozeUntil;
}

/** "Maybe later" — re-ask after ~2 weeks and +20 mined cards (ask already counted on show). */
export function applyMaybeLater(
  prompt: ReviewPromptState,
  minedCards: number,
  now = Date.now()
): ReviewPromptState {
  return {
    ...prompt,
    snoozeUntil: now + REVIEW_PROMPT_SNOOZE_MS,
    snoozeAfterCards: minedCards + REVIEW_PROMPT_SNOOZE_EXTRA_CARDS,
  };
}

/** "No thanks" — never ask again. */
export function applyNoThanks(prompt: ReviewPromptState): ReviewPromptState {
  return { ...prompt, dismissedForever: true };
}

/** User opened the CWS rating link — stop asking. */
export function applyRate(prompt: ReviewPromptState): ReviewPromptState {
  return { ...prompt, dismissedForever: true };
}
