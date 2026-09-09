/**
 * Ownership of a pause this extension caused.
 *
 * Everything that pauses the learner's video has to be able to answer one
 * question before it resumes: is the video still paused because *we* paused it,
 * or because the learner has since taken over? `video.paused` is true either
 * way, which is how a deliberate stop got undone (issue #130) and how a
 * peek-pause outlived the popup that stole focus (issue #131).
 *
 * So a pause is *held*, and any sign of the learner taking over releases the
 * hold for good. Holding is per pause: a later peek-pause owns its own.
 */
export class PlaybackHold {
  private held = false;
  /**
   * One pause event we are still waiting for from our own `pause()` call.
   *
   * HTMLMediaElement.pause() flips `paused` synchronously but **queues** the
   * `pause` event, so the event lands after the call returns. A window that
   * only spans the call therefore mistakes our own pause for the learner's and
   * gives up a hold we do in fact own, which is how the peek-pause stopped
   * resuming at all. The expectation is a single pending flag instead: exactly
   * one pause event is ours, whenever it arrives.
   *
   * It cannot leak into a later learner pause, because a hold is only ever
   * taken on a playing video (both callers check), and pausing a playing video
   * always raises the event that consumes this.
   */
  private ownPauseExpected = false;

  /** Record that we are about to pause, then pause through `doPause`. */
  hold(doPause: () => void): void {
    this.ownPauseExpected = true;
    doPause();
    this.held = true;
  }

  owned(): boolean {
    return this.held;
  }

  /**
   * A pause event arrived. Ours changes nothing; theirs means the learner has
   * stopped the video deliberately and we must never undo that.
   */
  noticePause(): void {
    if (this.ownPauseExpected) {
      this.ownPauseExpected = false;
      return;
    }
    this.held = false;
  }

  /**
   * A play event. Judged against the video's state at the moment it is handled,
   * not by the event's arrival: media events are queued, so a play the learner
   * triggered just before we took a hold can land after it. Reading the state
   * makes a stale event harmless, where trusting the order would hand back a
   * pause we own and leave the learner stopped with nothing to resume it.
   */
  noticePlay(paused: boolean): void {
    if (paused) return;
    this.held = false;
    this.ownPauseExpected = false;
  }

  /**
   * A seek. While paused this is #130's exact gesture: the learner stopped to
   * study and is now moving to another moment, still stopped. Seeking during
   * playback says nothing about who owns a pause.
   */
  noticeSeek(paused: boolean): void {
    if (paused) this.held = false;
  }

  /**
   * Give the pause back, once. Returns false when we no longer own it, so the
   * caller knows not to touch playback, and false on a second call, so two
   * timers cannot both resume the same hold.
   */
  release(): boolean {
    this.ownPauseExpected = false;
    if (!this.held) return false;
    this.held = false;
    return true;
  }
}
