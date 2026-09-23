/**
 * Which subtitle was on screen at each moment of the video.
 *
 * Listening Mode hears a line seconds after it was spoken, and by then the
 * page shows the next subtitle. Pairing the heard line with "whatever is on
 * screen now" put every Japanese line next to the wrong English one. Sampling
 * the on-screen text against the video clock lets a line be paired with the
 * subtitle that was up while it was being said.
 */

/** Plenty for the few seconds a transcript lags, at one entry per change. */
const MAX_ENTRIES = 300;

export class SubtitleHistory {
  private entries: { t: number; text: string }[] = [];

  /** Note what is on screen at video time `t` (seconds). */
  record(t: number, text: string): void {
    if (!Number.isFinite(t)) return;
    const last = this.entries[this.entries.length - 1];
    if (last && t < last.t) {
      // A seek back: what we knew about later moments is re-sampled as the
      // video plays them again, so drop it rather than interleave timelines.
      this.entries = this.entries.filter((e) => e.t <= t);
    }
    const tail = this.entries[this.entries.length - 1];
    if (tail && tail.text === text) return;
    this.entries.push({ t, text });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
  }

  /**
   * The subtitle for speech that began at `t`: the one on screen then, or —
   * when the screen was blank at that instant, since a subtitle often appears
   * a beat after the voice — the first one shown within `lookahead` seconds.
   * `null` when `t` is outside what was sampled, so the caller can fall back.
   */
  textAt(t: number, lookahead = 1.5): string | null {
    if (!this.entries.length || !Number.isFinite(t) || t < this.entries[0].t) return null;
    let i = this.entries.length - 1;
    while (i > 0 && this.entries[i].t > t) i--;
    if (this.entries[i].text) return this.entries[i].text;
    for (let j = i + 1; j < this.entries.length && this.entries[j].t <= t + lookahead; j++) {
      if (this.entries[j].text) return this.entries[j].text;
    }
    return "";
  }

  clear(): void {
    this.entries = [];
  }
}
