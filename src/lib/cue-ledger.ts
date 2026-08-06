export const MAX_TRACKED_CUES = 2_000;

/** Bounded FIFO set used to suppress overlapping transcript deliveries. */
export class CueLedger {
  private readonly seen = new Set<string>();
  private order: string[] = [];
  private head = 0;

  constructor(private readonly capacity = MAX_TRACKED_CUES) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("cue ledger capacity must be a positive integer");
    }
  }

  /** Returns true only the first time a cue is remembered while retained. */
  remember(key: string): boolean {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    this.order.push(key);

    if (this.seen.size > this.capacity) {
      const oldest = this.order[this.head++];
      this.seen.delete(oldest);
      // Compact occasionally so long-running sessions do not retain an
      // ever-growing array behind the bounded Set.
      if (this.head >= 1_024 && this.head * 2 >= this.order.length) {
        this.order = this.order.slice(this.head);
        this.head = 0;
      }
    }
    return true;
  }

  clear(): void {
    this.seen.clear();
    this.order = [];
    this.head = 0;
  }

  get size(): number {
    return this.seen.size;
  }
}
