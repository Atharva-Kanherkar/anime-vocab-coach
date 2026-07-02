# 07 — Final QA Checklist

Run top to bottom in a fresh Chrome profile. Every box must pass.

## Install & idle behavior
- [ ] Extension loads unpacked with no errors/warnings on `chrome://extensions`.
- [ ] Defaults seeded on install (`settings` in storage matches the defaults table in docs/00).
- [ ] On a YouTube page with **no captions enabled**: no cards ever, no tokenizer/dictionary load (check Network tab of the tab's DevTools — no `dict/*.dat.gz` fetches), no console errors.
- [ ] On netflix.com browse page (no playback): silent, no errors.

## YouTube core loop
- [ ] Japanese CC on → first card within ~2 min of dense dialogue.
- [ ] Card shows correct word/reading/gloss; sentence shows with the word highlighted.
- [ ] Each button does what docs/00 says (verify storage after each) and video resumes.
- [ ] Esc and outside-click dismiss without writing a judgment.
- [ ] Keys 1/2/3 judge; the video does NOT seek (shortcut swallowing works).
- [ ] Cooldown respected (no two cards within 20 s); hourly cap respected (set `maxCardsPerHour` to 2 and verify the 3rd doesn't fire).
- [ ] "I know it" word never triggers again after seeking back.
- [ ] Fullscreen: card renders in fullscreen; enter/exit fullscreen with card open keeps it visible and functional.
- [ ] SPA-navigate to a second video: capture still works; session word-set was reset (a word targeted in video 1 can trigger in video 2 if still eligible? NO — per docs/02 §5 rule 6 the set is per **session**; verify the set clears on path change per docs/04 §3... note: docs define session = per-video. The targeted set clears on navigation. Confirm this behavior).
- [ ] English-subtitled video: zero cards.
- [ ] Video with an ad: no crash during/after the ad.

## Modes & settings
- [ ] Notify mode: toast instead of pause; clicking toast pauses + opens card.
- [ ] Off mode: nothing happens; `seenCount`/`met` still NOT tracked (off means off — pipeline never runs).
- [ ] Every options control saves on change and takes effect after tab reload.
- [ ] Auto-resume: set to 5 s → untouched card closes itself and resumes playback, no judgment written.

## SRS
- [ ] "Learn it" creates `srs {stage:1, lapses:0}` with `dueAt ≈ now + 4 h`.
- [ ] Due learning word appearing in subs → quiz card, bypasses cooldown, answer hidden until "Show answer".
- [ ] Got it at stage 5 → state becomes `known`, `srs` null.
- [ ] Forgot → stage 1, `lapses` incremented.

## Popup & data
- [ ] All popup numbers match a manual count from raw storage.
- [ ] Streak: judge a word today → streak ≥ 1; fake yesterday's entry in storage → streak 2.
- [ ] State toggle in popup persists and content script respects it after reload.
- [ ] Export JSON opens as valid JSON and contains settings+vocab+stats.
- [ ] Reset clears vocab+stats, keeps settings, popup shows zeros.

## Netflix
- [ ] Japanese subs → cards work, resume works, fullscreen works.
- [ ] Title → browse → another title without reload: still works.

## Generic
- [ ] `test/track.html` via localhost (with temporary host permission): cues → cards.

## Robustness
- [ ] Two YouTube tabs playing simultaneously: both work independently; storage totals are sane.
- [ ] Tab open for 30+ min: watchMin increments only while actually playing.
- [ ] No uncaught errors in page console or service-worker console across all the above.
