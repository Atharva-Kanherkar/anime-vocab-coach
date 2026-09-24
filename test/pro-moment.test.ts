import { describe, expect, it } from "vitest";
import {
  WORD_MILESTONES,
  highestMilestone,
  keptWordCount,
  milestoneReached,
  proPromptEligible,
} from "../src/lib/pro-moment";

/** #162: the popup offers Pro when the deck crosses a milestone, once each. */
describe("milestoneReached", () => {
  it("stores the first observation silently", () => {
    expect(milestoneReached(null, 300)).toEqual({ store: 250, milestone: null });
    expect(milestoneReached(null, 4)).toEqual({ store: 0, milestone: null });
  });

  it("celebrates crossing the first milestone", () => {
    expect(milestoneReached(0, 10)).toEqual({ store: 10, milestone: 10 });
  });

  it("celebrates only the highest one crossed, once", () => {
    const first = milestoneReached(0, 60);
    expect(first).toEqual({ store: 50, milestone: 50 });
    expect(milestoneReached(first.store, 60)).toEqual({ store: 50, milestone: null });
  });

  it("stays quiet below the first milestone and never lowers the stored value", () => {
    expect(milestoneReached(0, 9)).toEqual({ store: 0, milestone: null });
    expect(milestoneReached(100, 40)).toEqual({ store: 100, milestone: null });
  });

  it("tolerates junk counts", () => {
    expect(milestoneReached(0, Number.NaN)).toEqual({ store: 0, milestone: null });
    expect(milestoneReached(0, -5)).toEqual({ store: 0, milestone: null });
    expect(highestMilestone(1e9)).toBe(WORD_MILESTONES[WORD_MILESTONES.length - 1]);
  });
});

describe("keptWordCount", () => {
  it("counts learning and known words, not seen or ignored ones", () => {
    expect(
      keptWordCount({
        a: { state: "learning" },
        b: { state: "known" },
        c: { state: "new" },
        d: { state: "ignored" },
        e: null,
      })
    ).toBe(2);
  });
});

describe("proPromptEligible", () => {
  it("asks only a signed-in free account with caps", () => {
    expect(proPromptEligible({ plan: "free" })).toBe(true);
    expect(proPromptEligible({ plan: "free", unlimited: true })).toBe(false);
    expect(proPromptEligible({ plan: "pro" })).toBe(false);
    expect(proPromptEligible({ plan: "max" })).toBe(false);
    expect(proPromptEligible(null)).toBe(false);
  });
});
