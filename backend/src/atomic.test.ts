import { describe, expect, it } from "vitest";
import { addToSlot, claimSlot, liveSlot } from "./atomic";

describe("Atomic slot transitions", () => {
  const now = 1_800_000_000_000;

  it("adds, refreshes the TTL, and never goes negative", () => {
    const a = addToSlot(undefined, 2, 1000, now);
    expect(a).toEqual({ v: 2, exp: now + 1000 });
    expect(addToSlot(a, 3, 1000, now + 10).v).toBe(5);
    expect(addToSlot(a, -10, 1000, now).v).toBe(0);
  });

  it("restarts an expired counter from zero", () => {
    expect(addToSlot({ v: 9, exp: now - 1 }, 1, 1000, now).v).toBe(1);
    expect(liveSlot({ v: 9, exp: now }, now)).toBeUndefined();
  });

  it("lets exactly one owner hold a lock until it expires", () => {
    const a = claimSlot(undefined, "a", 1000, now);
    expect(a.ok).toBe(true);
    expect(claimSlot(a.next, "b", 1000, now + 1).ok).toBe(false);
    expect(claimSlot(a.next, "a", 1000, now + 1).ok).toBe(true);
    expect(claimSlot(a.next, "b", 1000, now + 1001).ok).toBe(true);
  });
});
