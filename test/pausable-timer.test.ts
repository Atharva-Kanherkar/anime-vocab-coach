import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PausableTimer } from "../src/lib/pausable-timer";

// Regression cover for issue #127: pausing the video cleared the active vocab
// card, which is exactly when a learner wants to study it.
describe("PausableTimer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after the armed delay", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    vi.advanceTimersByTime(999);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledOnce();
  });

  it("does not fire while frozen, however long the pause lasts", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    vi.advanceTimersByTime(400);
    timer.freeze();
    vi.advanceTimersByTime(60_000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("resumes with the time that was left, not a fresh delay", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    vi.advanceTimersByTime(400);
    timer.freeze();
    vi.advanceTimersByTime(10_000);
    timer.thaw();
    vi.advanceTimersByTime(599);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledOnce();
  });

  // A card can open on an already-paused frame, and the pause event can land
  // before the card arms its own clock. Freezing has to be a state, not an
  // event, or that card would count down while the video sat still.
  it("banks the delay when armed while already frozen", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.freeze();
    timer.arm(1000, fire);
    vi.advanceTimersByTime(30_000);
    expect(fire).not.toHaveBeenCalled();
    timer.thaw();
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledOnce();
  });

  it("ignores repeated freezes and stray thaws", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    vi.advanceTimersByTime(300);
    timer.freeze();
    timer.freeze(); // must not re-bank a shorter remainder
    vi.advanceTimersByTime(5000);
    timer.thaw();
    timer.thaw(); // must not restart the countdown
    vi.advanceTimersByTime(700);
    expect(fire).toHaveBeenCalledOnce();
  });

  it("re-arms to the new delay while frozen", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    timer.freeze();
    timer.arm(4000, fire);
    timer.thaw();
    vi.advanceTimersByTime(3999);
    expect(fire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fire).toHaveBeenCalledOnce();
  });

  it("stays dead after clear", () => {
    const fire = vi.fn();
    const timer = new PausableTimer();
    timer.arm(1000, fire);
    timer.clear();
    expect(timer.armed).toBe(false);
    timer.thaw();
    vi.advanceTimersByTime(10_000);
    expect(fire).not.toHaveBeenCalled();
  });

  it("reports armed across a freeze so the hard cap is not re-armed", () => {
    const timer = new PausableTimer();
    timer.arm(45_000, () => {});
    timer.freeze();
    expect(timer.armed).toBe(true);
    expect(timer.frozen).toBe(true);
  });
});
