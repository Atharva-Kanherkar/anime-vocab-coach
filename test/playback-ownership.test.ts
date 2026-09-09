import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { PlaybackHold } from "../src/lib/playback-hold";

// Issues #130 and #131. Both are the same defect: our resume paths gated on
// video.paused, which is true whether we paused the video or the learner did.
/**
 * A media element shaped like the spec: `pause()` and `play()` flip `paused`
 * synchronously and QUEUE their events. Getting that wrong is what made the
 * first version of the hold give up its own pause instantly, so the fake
 * models it rather than firing synchronously.
 */
class FakeVideo {
  paused = false;
  private handlers: Record<string, (() => void)[]> = {};
  private queued: (() => void)[] = [];

  addEventListener(type: string, handler: () => void): void {
    (this.handlers[type] ||= []).push(handler);
  }

  private emitLater(type: string): void {
    this.queued.push(() => (this.handlers[type] || []).forEach((h) => h()));
  }

  /** Run the queued media events, as the browser's task loop would. */
  flush(): void {
    const q = this.queued;
    this.queued = [];
    q.forEach((f) => f());
  }

  pause(): void {
    if (this.paused) return; // pausing a paused video raises nothing
    this.paused = true;
    this.emitLater("pause");
  }

  play(): void {
    if (!this.paused) return;
    this.paused = false;
    this.emitLater("play");
  }

  seek(): void {
    this.emitLater("seeking");
    this.emitLater("seeked");
  }
}

/** Wire a hold to a video the way sub-lens.ts and agent-panel.ts do. */
function wire(hold: PlaybackHold, video: FakeVideo): void {
  video.addEventListener("pause", () => hold.noticePause());
  video.addEventListener("play", () => hold.noticePlay(video.paused));
  video.addEventListener("seeking", () => hold.noticeSeek(video.paused));
  video.addEventListener("seeked", () => hold.noticeSeek(video.paused));
}

describe("PlaybackHold", () => {
  it("owns a pause it caused, and keeps it when the queued event lands", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    expect(hold.owned()).toBe(true);
    video.flush(); // the pause event arrives a task later
    expect(hold.owned()).toBe(true);
    expect(hold.release()).toBe(true);
  });

  it("gives up ownership when the learner pauses a playing video", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    // Nothing held: this is their pause from the start.
    video.pause();
    video.flush();
    expect(hold.owned()).toBe(false);
    expect(hold.release()).toBe(false);
  });

  // #130: pause to study, then click a later point on the timeline.
  it("gives up ownership on a seek from a paused video", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    video.seek();
    video.flush();
    expect(hold.owned()).toBe(false);
    expect(hold.release()).toBe(false);
  });

  it("ignores a seek during playback", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    video.play();
    // Deliberately not flushed: the play event is still queued when the next
    // hold is taken, which is the real race (the learner presses play and the
    // pointer reaches the lens before the event is delivered). A stale play
    // must not steal the hold.
    hold.hold(() => video.pause());
    video.flush();
    expect(hold.owned(), "a queued play event stole the hold").toBe(true);
    video.paused = false; // now scrubbing while it plays
    video.seek();
    video.flush();
    expect(hold.owned()).toBe(true);
  });

  it("gives up ownership once the learner resumes", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    video.play();
    video.flush();
    expect(hold.owned()).toBe(false);
  });

  it("releases exactly once, so two timers cannot both resume", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    expect(hold.release()).toBe(true);
    expect(hold.release()).toBe(false);
  });

  it("can own a new pause after losing the last one", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    video.seek(); // learner takes over
    video.flush();
    expect(hold.owned()).toBe(false);
    video.play();
    video.flush();
    hold.hold(() => video.pause());
    video.flush();
    expect(hold.owned()).toBe(true);
  });

  it("does not mistake a later learner pause for the one it caused", () => {
    const video = new FakeVideo();
    const hold = new PlaybackHold();
    wire(hold, video);
    hold.hold(() => video.pause());
    video.flush();
    expect(hold.release()).toBe(true); // we resumed it
    video.play();
    video.flush();
    video.pause(); // their pause, later
    video.flush();
    expect(hold.owned()).toBe(false);
  });
});

// Wiring pins: sub-lens and agent-panel are DOM modules that reach for document
// at import time, so this reads the source the way listening-billing.test.ts
// does.
const lens = readFileSync(fileURLToPath(new URL("../src/lib/sub-lens.ts", import.meta.url)), "utf8");
const panel = readFileSync(fileURLToPath(new URL("../src/lib/agent-panel.ts", import.meta.url)), "utf8");

describe("every resume goes through the hold", () => {
  it("sub-lens resumes from exactly one place, and only when it still owns the pause", () => {
    // The bug was two separate `if (video && video.paused) video.play()` sites,
    // one on pointer-leave and one in hideLens, each judging ownership by a
    // property that is true either way. Now there is one resume, and it asks.
    const plays = [...lens.matchAll(/video\.play\(\)/g)];
    expect(plays).toHaveLength(1);
    const release = lens.slice(lens.indexOf("function releasePeekPause"));
    const body = release.slice(0, release.indexOf("\n}"));
    expect(body).toContain("video.play()");
    // The guard has to come first, or the check is decoration.
    expect(body.indexOf("peekHold.release()")).toBeLessThan(body.indexOf("video.play()"));
    expect(body).toMatch(/if \(!peekHold\.release\(\)\) return;/);
  });

  it("sub-lens watches for the learner taking over", () => {
    for (const event of ["pause", "seeking", "seeked", "play"]) {
      expect(lens, event).toMatch(new RegExp(`addEventListener\\("${event}"`));
    }
  });

  it("sub-lens gives up a peek-pause when the page loses focus", () => {
    // #131: the popup takes focus, and a held pause used to sit there until the
    // pointer came back to the page.
    expect(lens).toMatch(/addEventListener\("blur"/);
    expect(lens).toMatch(/addEventListener\("visibilitychange"/);
  });

  it("the card's resume consults the hold too", () => {
    const fn = panel.slice(panel.indexOf("function resumeVideoIfNeeded"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body).toMatch(/release\(\)/);
  });
});
