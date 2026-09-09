/**
 * A setTimeout whose clock can be frozen and thawed.
 *
 * Word cards auto-dismiss on a wall-clock timer, which fought pause-to-study:
 * a learner who paused the video to read the line they stopped on watched the
 * card disappear under them. Pausing the video now freezes the countdown and
 * playing resumes it with the time that was left, so a paused card waits as
 * long as the learner does.
 *
 * Freezing is a state, not an event: it can be set before anything is armed
 * (a card can open on an already-paused frame, and the pause event can beat
 * the card's own timer into place), and arming while frozen banks the duration
 * instead of starting it.
 */
export class PausableTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isFrozen = false;
  /** Milliseconds banked while frozen; null when there is nothing to resume. */
  private remaining: number | null = null;
  private deadline = 0;
  private fire: (() => void) | null = null;

  /** Start (or restart) the countdown. While frozen, banks `ms` instead. */
  arm(ms: number, fire: () => void): void {
    this.fire = fire;
    if (this.isFrozen) {
      this.remaining = ms;
      this.clearTimer();
      return;
    }
    this.start(ms);
  }

  /** Stop the clock, keeping whatever time was left. */
  freeze(): void {
    if (this.isFrozen) return;
    this.isFrozen = true;
    if (this.timer) {
      this.remaining = Math.max(0, this.deadline - Date.now());
      this.clearTimer();
    }
  }

  /** Resume from where the clock stopped. */
  thaw(): void {
    if (!this.isFrozen) return;
    this.isFrozen = false;
    const left = this.remaining;
    this.remaining = null;
    if (left !== null && this.fire) this.start(left);
  }

  /** Disarm completely; neither freeze nor thaw brings it back. */
  clear(): void {
    this.clearTimer();
    this.isFrozen = false;
    this.remaining = null;
    this.fire = null;
  }

  /** True once armed, whether it is currently counting or frozen. */
  get armed(): boolean {
    return this.fire !== null;
  }

  get frozen(): boolean {
    return this.isFrozen;
  }

  private start(ms: number): void {
    this.clearTimer();
    this.deadline = Date.now() + ms;
    this.timer = setTimeout(() => {
      const fire = this.fire;
      this.clear();
      fire?.();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
