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
  /**
   * The video the current hold was taken on, or null when nothing is held.
   *
   * A hold has to name its video, not just its existence. Players swap their
   * `<video>` between titles, and the resume paths resolve the element when
   * they fire rather than when the pause was taken — so a hold recorded as a
   * bare boolean let a peek-pause on the last episode start the next one, which
   * is issue #125's bleed wearing a different hat.
   */
  private heldVideo: HTMLVideoElement | null = null;
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

  /** Record that we are about to pause `video`, then pause through `doPause`. */
  hold(video: HTMLVideoElement, doPause: () => void): void {
    this.ownPauseExpected = true;
    doPause();
    this.heldVideo = video;
  }

  owned(): boolean {
    return this.heldVideo !== null;
  }

  /**
   * A pause event arrived. Ours changes nothing; theirs means the learner has
   * stopped the video deliberately and we must never undo that.
   *
   * Returns whether the pause was ours, so a caller that also reacts to the
   * learner pausing (freezing a dismissal clock, say) can tell the two apart
   * from this one answer rather than keeping a second flag of its own that can
   * drift out of step with this one.
   */
  noticePause(): boolean {
    if (this.ownPauseExpected) {
      this.ownPauseExpected = false;
      return true;
    }
    this.heldVideo = null;
    return false;
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
    this.heldVideo = null;
    this.ownPauseExpected = false;
  }

  /**
   * A seek. While paused this is #130's exact gesture: the learner stopped to
   * study and is now moving to another moment, still stopped. Seeking during
   * playback says nothing about who owns a pause.
   */
  noticeSeek(paused: boolean): void {
    if (paused) this.heldVideo = null;
  }

  /**
   * Give the pause back, once. Returns **the video the hold was taken on**, so
   * a caller can only ever resume that element — resolving the video at resume
   * time instead is how a peek-pause on one episode started the next one. Null
   * when we no longer own a pause, and null on a second call, so two timers
   * cannot both resume the same hold.
   */
  release(): HTMLVideoElement | null {
    this.ownPauseExpected = false;
    const video = this.heldVideo;
    this.heldVideo = null;
    return video;
  }

  /**
   * Drop the claim without resuming.
   *
   * For the cases where the learner has gone somewhere else entirely: the tab
   * is hidden, so starting playback would be audio in a window they are not
   * looking at. Resuming is right when they are still here (the toolbar popup,
   * issue #131); it is not right when they have left.
   */
  forfeit(): void {
    this.ownPauseExpected = false;
    this.heldVideo = null;
  }
}
