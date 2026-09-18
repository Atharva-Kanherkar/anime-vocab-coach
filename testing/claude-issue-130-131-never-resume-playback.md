# claude/issue-130-131-never-resume-playback — Test Contract

Fixes [#130](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/130)
(seeking while paused on Netflix resumes playback) and
[#131](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/131)
(opening the AnimeVocab popup pauses Netflix, which resumes on dismissal).

They arrived as two issues. They are one state machine: the only code in this
extension that can pause or resume the learner's video, and its inability to
tell its own pause from theirs.

## Root cause (established before writing code)

Every call that touches playback:

| Site | What it does |
|---|---|
| `sub-lens.ts:185` | peek-pause: pause while a word popup is open |
| `sub-lens.ts:206` | resume after the pointer leaves the lens |
| `sub-lens.ts:456` | resume when the lens is hidden (session reset, feature off) |
| `agent-panel.ts:1786` | focus-mode card pauses the video |
| `agent-panel.ts:964` | `resumeVideoIfNeeded` after a card finishes |

Both resume paths gate on `video.paused` plus a flag saying we paused it
(`wePaused`, `wasPlaying && !userResumed`). Neither can tell **"still paused
because we paused it"** from **"paused because the learner paused it since"**.
`video.paused` is true in both cases.

- **#130**: the learner pauses to study, then clicks the timeline. Netflix
  reveals its UI on mouse move, the pointer leaves the lens, the resume timer
  fires, `video.paused` is true, and we call `play()`. The deliberate stop is
  gone.
- **#131**: the pointer crosses the subtitle line on its way to the toolbar, so
  the lens peek-pauses. The popup opens and the page loses focus with
  `wePaused` still true and no pointer left in the document to trigger the
  leave path, so Netflix sits paused for as long as the popup is open, then
  resumes when the pointer returns. Nothing in this extension gives up a
  peek-pause when the page stops being where the learner is looking.

`hideLens()` has the same flaw as the leave path, so a session reset can resume
a video the learner stopped.

## Functional Behavior

### We only ever undo our own pause

- A pause we cause is *owned*: recorded with the fact that we caused it.
- Ownership is lost, permanently for that pause, as soon as the learner takes
  over. Any of these hands it back to them:
  - a `pause` event we did not cause (they hit space, or clicked pause);
  - a `seeking` or `seeked` event while the video is paused (this is #130's
    exact gesture: seek from a deliberate stop);
  - a `play` event (they resumed themselves; nothing left to resume).
- With ownership lost, no resume path runs: not the pointer-leave timer, not
  `hideLens()`, not `resumeVideoIfNeeded()` after a card. The video stays
  exactly as the learner left it.
- Ownership is per pause, not per session: a later peek-pause can own its own
  pause again.

### A peek-pause never outlives the learner's attention (#131)

- When the page loses focus (`blur`) or becomes hidden
  (`visibilitychange`), an owned peek-pause is released immediately: the video
  resumes and ownership clears.
- If the learner had taken over by then, nothing happens, because ownership was
  already gone.
- This is what stops the popup from parking Netflix in a paused state: whatever
  the pointer did on its way to the toolbar, the page losing focus undoes our
  pause rather than holding it until the pointer comes back.
- The lens tooltip is hidden at the same time. A word popup pinned over a video
  the learner has walked away from is stale.

### Focus-mode cards keep their existing bargain

- A focus-mode card still pauses the video and still resumes it when the card
  resolves, which is the whole point of Focus mode.
- But if the learner pauses or seeks while that card is up, ownership is lost
  and the card no longer resumes on dismissal.

## Unit Tests

`test/playback-ownership.test.ts` against a new pure module
(`src/lib/playback-hold.ts`) that owns the state machine:

- `hold()` records ownership; `owned()` is true after it.
- `noticePause()` (a pause we did not cause) clears ownership.
- `noticeSeek()` while paused clears ownership; while playing it does not.
- `noticePlay()` clears ownership.
- `release()` returns true only while owned, and only once: a second call
  returns false, so two timers cannot both resume.
- Our own `pause()` call does not clear ownership (the pause event it raises is
  recognised as ours).
- A fresh `hold()` after a lost pause owns the new pause.

## Integration / Functional Tests

`test/playback-ownership.test.ts` (source-read pins):

- `sub-lens.ts` routes every `play()` through the hold's release, and no longer
  calls `play()` on a bare `video.paused` check.
- `sub-lens.ts` binds `pause`, `seeking`, `seeked` and `play` on the video, and
  `blur`/`visibilitychange` on the window/document.
- `agent-panel.ts`'s `resumeVideoIfNeeded` consults the hold.

## Smoke Tests

- `npm run typecheck`, `npm run test:unit`, `node build.mjs`, bundles
  reproducible.

## E2E Tests

`e2e/playback-hold.mjs`, headed, on the served-watch-page harness (a real
content script against a canvas-backed video whose play/pause fire real events):

- **#130**: with the lens peek-pause armed, pause the video as the learner
  would, seek, move the pointer off the lens, and wait past the resume delay.
  The video must still be paused.
- **#131**: arm a peek-pause, then blur the page (as opening the popup does).
  The video must be playing again within a beat, and must not be paused when
  focus returns.
- The feature still works: hover the lens while playing → paused; leave → plays
  again.

Netflix itself is not driven (account, licensed stream, and a DOM that is not
ours to depend on). The harness reproduces the gestures and the events; the
per-site part of #130 is Netflix revealing its UI on mouse move, which is not
something our code can observe anyway.

## Manual / cURL Tests

N/A for cURL. Manual pass on Netflix by the maintainer, for the two reported
sequences:

1. Play, pause, click a later point on the timeline. Playback must stay paused.
2. Play, open the AnimeVocab popup, dismiss it. Playback must be unchanged
   throughout.

## Review follow-ups (amended after the first implementation pass)

**One mechanism, not two.** PR #134 merged in the meantime and had already added
its own ownership flags to `presentWord` — `selfPaused` for our pause versus the
learner's, `userPaused` for a pause taken under an open card. Carrying both
would leave two state machines answering one question about one pause, and
`resumeVideoIfNeeded`'s `&&` chain would skip whichever check came second. The
merge keeps `PlaybackHold` alone; `noticePause()` now reports whether the pause
was ours, which is what #134's flags were for.

- Grading a card on a learner-paused video leaves it paused (#127).
- A card that opens on an already-paused frame freezes its dismissal clock; a
  card that paused the video itself does not.

**A hold names its video.** The hold recorded *that* we had paused, not *what*.
The resume paths resolve the element when they fire, and players swap `<video>`
between titles — so a peek-pause taken on one episode started the next one, the
same bleed as #125. Reproduced before the fix: video B, loaded stopped, was
playing after `hideLens()` ran on the session change.

- `release()` hands back the element the hold was taken on, or null.
- A hold taken on one video is never handed back to another.
- Listeners are detached from a video the lens stops watching, and from the
  card's video when the card ends.

**A hidden tab is not a blurred one.** `visibilitychange` → hidden resumed
playback, which is audio in a window the learner has left. #131's reported case
is the toolbar popup, which raises `blur`.

- On `blur`, the pause is handed back (#131, unchanged).
- On hidden, the claim is forfeited and the video is left where it is.
