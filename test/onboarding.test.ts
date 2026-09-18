import { describe, expect, it } from "vitest";
import {
  EMPTY_ONBOARDING,
  ONBOARDING_CHECKLIST_AFTER_MS,
  ONBOARDING_STEPS,
  applyStamp,
  checklistSteps,
  isActivated,
  isFirstCardTransition,
  normalizeOnboarding,
  shouldCelebrate,
  shouldShowChecklist,
} from "../src/lib/onboarding";
import { EXTENSION_EVENTS, isExtensionEvent } from "../src/lib/extension-events";

const T0 = 1_750_000_000_000;

describe("normalizeOnboarding", () => {
  it("treats a missing or junk value as a fresh, unstamped install", () => {
    expect(normalizeOnboarding(undefined)).toEqual(EMPTY_ONBOARDING);
    expect(normalizeOnboarding(null)).toEqual(EMPTY_ONBOARDING);
    expect(normalizeOnboarding("garbage")).toEqual(EMPTY_ONBOARDING);
    expect(normalizeOnboarding(42)).toEqual(EMPTY_ONBOARDING);
  });

  it("clamps values that would sort before every real timestamp", () => {
    const state = normalizeOnboarding({
      installedAt: -5,
      shownAt: Number.NaN,
      watchedAt: "not a number",
      cardShownAt: Number.POSITIVE_INFINITY,
    });
    expect(state.installedAt).toBe(0);
    expect(state.shownAt).toBe(0);
    expect(state.watchedAt).toBe(0);
    expect(state.cardShownAt).toBe(0);
  });

  it("coerces a stored string timestamp rather than dropping the progress", () => {
    expect(normalizeOnboarding({ installedAt: String(T0) }).installedAt).toBe(T0);
    expect(normalizeOnboarding({ firstCardAt: T0 + 0.7 }).firstCardAt).toBe(T0);
  });

  it("drops unknown keys so an old or corrupted shape cannot leak through", () => {
    expect(normalizeOnboarding({ installedAt: T0, sneaky: true })).toEqual({
      ...EMPTY_ONBOARDING,
      installedAt: T0,
    });
  });
});

describe("applyStamp", () => {
  it("stamps a field that has not happened yet", () => {
    expect(applyStamp(EMPTY_ONBOARDING, "watchedAt", T0).watchedAt).toBe(T0);
  });

  it("never overwrites a stamp — re-watching must not reset the funnel", () => {
    const first = applyStamp(EMPTY_ONBOARDING, "watchedAt", T0);
    const second = applyStamp(first, "watchedAt", T0 + 90_000);
    expect(second.watchedAt).toBe(T0);
    // Same reference, so the caller can skip the storage write entirely.
    expect(second).toBe(first);
  });

  it("leaves every other field alone", () => {
    const state = applyStamp(applyStamp(EMPTY_ONBOARDING, "installedAt", T0), "firstCardAt", T0 + 10);
    expect(state.installedAt).toBe(T0);
    expect(state.firstCardAt).toBe(T0 + 10);
    expect(state.shownAt).toBe(0);
    expect(state.celebratedAt).toBe(0);
  });
});

describe("shouldShowChecklist", () => {
  const aged = (ms: number) => ({ ...EMPTY_ONBOARDING, installedAt: T0 - ms });

  it("stays quiet for installs that predate onboarding (no honest clock)", () => {
    expect(shouldShowChecklist({ state: EMPTY_ONBOARDING, now: T0 })).toBe(false);
  });

  it("gives a fresh install its full day before nagging", () => {
    expect(shouldShowChecklist({ state: aged(ONBOARDING_CHECKLIST_AFTER_MS - 1), now: T0 })).toBe(false);
  });

  it("shows at exactly 24h with nothing mined", () => {
    expect(shouldShowChecklist({ state: aged(ONBOARDING_CHECKLIST_AFTER_MS), now: T0 })).toBe(true);
  });

  it("never shows once a card is mined, however old the install", () => {
    const state = { ...aged(30 * 24 * 3600e3), firstCardAt: T0 - 3600e3 };
    expect(shouldShowChecklist({ state, now: T0 })).toBe(false);
  });

  it("stays dismissed once dismissed", () => {
    const state = { ...aged(30 * 24 * 3600e3), checklistDismissedAt: T0 - 1000 };
    expect(shouldShowChecklist({ state, now: T0 })).toBe(false);
  });
});

describe("shouldCelebrate", () => {
  it("owes nothing before the first card", () => {
    expect(shouldCelebrate(EMPTY_ONBOARDING)).toBe(false);
    expect(isActivated(EMPTY_ONBOARDING)).toBe(false);
  });

  it("owes the moment once, then stops", () => {
    const mined = { ...EMPTY_ONBOARDING, firstCardAt: T0 };
    expect(shouldCelebrate(mined)).toBe(true);
    expect(isActivated(mined)).toBe(true);
    expect(shouldCelebrate({ ...mined, celebratedAt: T0 + 1 })).toBe(false);
  });
});

describe("checklistSteps", () => {
  it("is the issue's three steps, in order", () => {
    expect(checklistSteps(EMPTY_ONBOARDING).map((s) => s.id)).toEqual(["watch", "panel", "mine"]);
    expect(ONBOARDING_STEPS).toHaveLength(3);
  });

  it("marks each step from its own stamp, independently", () => {
    const steps = checklistSteps({ ...EMPTY_ONBOARDING, watchedAt: T0 });
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
  });

  it("does not retroactively tick earlier steps when a later one lands", () => {
    // Someone can mine a word off the Subtitle Lens without the panel ever
    // opening. The checklist must show that honestly, not fake a tidy sequence.
    const steps = checklistSteps({ ...EMPTY_ONBOARDING, firstCardAt: T0 });
    expect(steps.map((s) => s.done)).toEqual([false, false, true]);
  });
});

describe("onboarding_shown event", () => {
  it("is allowlisted, so the beacon is not dropped on arrival", () => {
    expect(EXTENSION_EVENTS).toContain("onboarding_shown");
    expect(isExtensionEvent("onboarding_shown")).toBe(true);
    expect(isExtensionEvent("onboarding_shown_evil")).toBe(false);
  });
});

describe("isFirstCardTransition", () => {
  const withCard = { ...EMPTY_ONBOARDING, firstCardAt: T0 };

  it("fires on the change that first sets firstCardAt", () => {
    expect(isFirstCardTransition(EMPTY_ONBOARDING, withCard)).toBe(true);
    // A brand-new key has no oldValue at all.
    expect(isFirstCardTransition(undefined, withCard)).toBe(true);
  });

  it("does not fire on later writes to the same key", () => {
    // Every subsequent save rewrites the object; only the first is the moment.
    expect(isFirstCardTransition(withCard, { ...withCard, celebratedAt: T0 + 1 })).toBe(false);
  });

  it("does not fire on an unrelated stamp landing", () => {
    expect(
      isFirstCardTransition(EMPTY_ONBOARDING, { ...EMPTY_ONBOARDING, watchedAt: T0 })
    ).toBe(false);
  });

  it("does not fire on the key being cleared", () => {
    expect(isFirstCardTransition(withCard, undefined)).toBe(false);
  });
});
