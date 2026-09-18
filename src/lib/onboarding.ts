/**
 * First-run onboarding state (issue #77).
 *
 * ~24% of installs uninstalled without ever mining a card. The fix is a guided
 * path from install to first card, which needs to know how far along a learner
 * actually is. This module is the pure half of that: one storage shape, five
 * write-once timestamps, and the predicates the welcome page and the popup both
 * read. No chrome APIs here so it stays unit-testable — the storage-backed
 * half lives in `onboarding-store.ts`.
 */

/** `chrome.storage.local` key holding the state below. */
export const ONBOARDING_STORAGE_KEY = "onboarding";

/** How long a fresh install gets before the popup starts showing the checklist. */
export const ONBOARDING_CHECKLIST_AFTER_MS = 24 * 3600e3;

/**
 * Epoch-ms stamps; `0` means "has not happened". Every one of them is
 * write-once (see `applyStamp`), so the 24h clock and the step ticks cannot be
 * reset by ordinary use — re-watching an episode must not un-tick a step.
 */
export interface OnboardingState {
  /** `runtime.onInstalled` with reason "install". 0 on installs that predate #77. */
  installedAt: number;
  /** The welcome page painted. */
  shownAt: number;
  /** A word was stored off a subtitle line — an anime is playing and being read. */
  watchedAt: number;
  /** The panel put a word card on screen. */
  cardShownAt: number;
  /** A word was actually saved (`know` / `learn`) — the activation moment. */
  firstCardAt: number;
  /** The 🎉 moment has been shown, so it does not re-fire on every open. */
  celebratedAt: number;
  /** The learner closed the popup checklist. */
  checklistDismissedAt: number;
}

export const EMPTY_ONBOARDING: OnboardingState = {
  installedAt: 0,
  shownAt: 0,
  watchedAt: 0,
  cardShownAt: 0,
  firstCardAt: 0,
  celebratedAt: 0,
  checklistDismissedAt: 0,
};

/** Every field is a stamp, so `applyStamp` cannot be handed a name that is not one. */
export type OnboardingStamp = keyof OnboardingState;

function stamp(v: unknown): number {
  const n = Number(v);
  // Number("") is 0 and Number(null) is 0, which is exactly the "unset" value —
  // but NaN and negatives would sort before every real timestamp, so clamp.
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function normalizeOnboarding(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== "object") return { ...EMPTY_ONBOARDING };
  const o = raw as Record<string, unknown>;
  return {
    installedAt: stamp(o.installedAt),
    shownAt: stamp(o.shownAt),
    watchedAt: stamp(o.watchedAt),
    cardShownAt: stamp(o.cardShownAt),
    firstCardAt: stamp(o.firstCardAt),
    celebratedAt: stamp(o.celebratedAt),
    checklistDismissedAt: stamp(o.checklistDismissedAt),
  };
}

/**
 * Write-once stamp. Returns the *same object reference* when the field is
 * already set, so callers can skip the storage write with `next === state`.
 */
export function applyStamp(
  state: OnboardingState,
  field: OnboardingStamp,
  now: number
): OnboardingState {
  if (state[field] > 0) return state;
  return { ...state, [field]: stamp(now) || 1 };
}

/** The learner has mined a card — the one milestone that ends onboarding. */
export function isActivated(state: OnboardingState): boolean {
  return state.firstCardAt > 0;
}

export interface OnboardingStep {
  id: "watch" | "panel" | "mine";
  /** Which stamp marks this step done. */
  stampField: OnboardingStamp;
  title: string;
  detail: string;
}

/**
 * The three steps, in the issue's order. One list so the welcome page and the
 * popup checklist cannot drift into describing different products.
 *
 * Issue #77 writes step 2 as "click the あ button". There is no あ button — the
 * on-player control is the AnimeVocab copilot rail (`agent-panel.ts`), so the
 * copy names what is actually on screen.
 */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "watch",
    stampField: "watchedAt",
    title: "Play any anime",
    detail: "Crunchyroll, Netflix or YouTube, with Japanese audio or Japanese subtitles.",
  },
  {
    id: "panel",
    stampField: "cardShownAt",
    title: "Open the AnimeVocab panel",
    detail: "The アニ rail sits at the edge of the player. It picks one word per line for you.",
  },
  {
    id: "mine",
    stampField: "firstCardAt",
    title: "Click a word to save it",
    detail: "That is your first card. It comes back for review on its own.",
  },
] as const;

export interface ChecklistStep extends OnboardingStep {
  done: boolean;
}

/** The three steps with their own completion marked — each from its own stamp. */
export function checklistSteps(state: OnboardingState): ChecklistStep[] {
  return ONBOARDING_STEPS.map((step) => ({ ...step, done: state[step.stampField] > 0 }));
}

export interface ChecklistVisibilityInput {
  state: OnboardingState;
  now?: number;
}

/**
 * Show the popup checklist to an install that has had a full day and still has
 * no card. `installedAt === 0` means the install predates #77: it has no honest
 * clock, and a long-time user does not need a first-run checklist.
 */
export function shouldShowChecklist(input: ChecklistVisibilityInput): boolean {
  const { state } = input;
  const now = input.now ?? Date.now();
  if (state.installedAt === 0) return false;
  if (isActivated(state)) return false;
  if (state.checklistDismissedAt > 0) return false;
  return now - state.installedAt >= ONBOARDING_CHECKLIST_AFTER_MS;
}

/** The 🎉 first-card moment is owed, and has not been shown yet. */
export function shouldCelebrate(state: OnboardingState): boolean {
  return isActivated(state) && state.celebratedAt === 0;
}
