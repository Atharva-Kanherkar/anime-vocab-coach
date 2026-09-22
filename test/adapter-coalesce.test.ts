import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coalesce } from "../src/lib/adapters/util";

// The adapters used to debounce their MutationObserver. A streaming player's
// DOM mutates every few milliseconds, so a trailing debounce never fired and
// the subtitle was read late or not at all.
describe("coalesce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs within its window even when requests never stop", () => {
    const fn = vi.fn();
    const schedule = coalesce(fn, 50);
    // A mutation every 10ms for half a second: a debounce would still be waiting.
    for (let t = 0; t < 500; t += 10) {
      schedule();
      vi.advanceTimersByTime(10);
    }
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(9);
  });

  it("batches a burst into one call", () => {
    const fn = vi.fn();
    const schedule = coalesce(fn, 50);
    schedule();
    schedule();
    schedule();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
