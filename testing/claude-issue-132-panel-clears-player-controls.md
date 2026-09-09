# claude/issue-132-panel-clears-player-controls — Test Contract

Fixes [#132](https://github.com/Atharva-Kanherkar/anime-vocab-coach/issues/132):
the in-player side panel covers Netflix's right-hand control cluster
(subtitles, speed, next episode, fullscreen), so switching to Japanese captions
or turning captions off for Listening Mode means closing the study panel first.

## Root cause (established before writing code)

`.avc-agent-sidebar` in `src/lib/agent-panel.ts` is
`position: fixed; top: 0; right: 0; bottom: 0` at 340px wide, i.e. a full-height
strip down the right edge of the viewport. Netflix's control bar sits at the
bottom of the player and its right cluster lands underneath the bottom of that
strip.

The container is already `pointer-events: none` so its transparent middle passes
clicks through (an earlier fix). That is not enough here:

- The **composer** (chat input) and the **foot** (Learn / Know / Skip) are
  `pointer-events: auto` and sit at the bottom of the strip, exactly where the
  host's control cluster is. Clicks there hit the panel, not the player.
- Even where clicks do pass through, the panel's tint and 20px backdrop blur are
  painted over those controls once the panel is hovered or active, so they are
  hard to see and hard to aim at.

## Functional Behavior

### The panel clears the host control strip

- The sidebar leaves a bottom clearance so neither its interactive regions nor
  its painted background overlap the host player's control bar:
  `clamp(96px, 13vh, 168px)`, which covers Netflix's bar (the tallest of the
  supported players) and scales with the window.
- The clearance applies to the whole sidebar, so the blur and tint stop above
  the control bar too, not just the click targets.
- The resize grip, which spans the sidebar's height, shortens with it. Resizing
  still works and still clamps to `PANEL_MIN_W`/`PANEL_MAX_W`.
- The clearance is a CSS custom property on the sidebar, so it is one value to
  change per platform later rather than a magic number scattered through rules.

### Collapse to a rail, without losing the card (acceptance 2)

- A collapse control in the panel head shrinks the sidebar to a narrow rail
  (36px) pinned to the right edge. The rail shows the AnimeVocab mark and an
  expand affordance, and nothing else.
- Collapsing does **not** unmount the panel, dismiss the active card, resolve
  the pending judgment, or clear the chat. Expanding shows the same card with
  the same state.
- While collapsed, everything except the rail is click-through, so the whole
  player including the right cluster is reachable.
- The collapsed choice persists per learner (`agentPanelCollapsed` in extension
  storage) and is applied on the next mount, the way the panel width already is.
- The card's auto-dismiss clock is untouched by collapsing: a collapsed panel is
  not a paused video, and a card that times out while collapsed is the same card
  that would have timed out while expanded.
- Closing (the existing `×`) still unmounts and still resolves a pending
  judgment as dismissed. Collapse and close stay distinct actions with distinct
  labels.

### Reaching the host's caption menu (acceptance 3)

Out of scope for this change: an in-panel caption toggle means driving each
host's own menu, which is a per-site DOM contract that breaks on their next
redesign. The two acceptance bullets above make the host's own control reachable
instead, which is the durable version of the same outcome. Recorded here so the
omission is deliberate rather than forgotten.

## Unit Tests

`test/panel-layout.test.ts` (pure, no DOM):

- `panelBottomClearance()` returns the documented clamp expression, and the
  rendered CSS contains it exactly once for the sidebar rule.
- `collapsedWidth()` is narrower than `PANEL_MIN_W`, so the rail cannot be
  confused with a resized panel.
- Collapse state round-trips through the storage helper's parser: unset →
  false, `true` → true, junk → false.

## Integration / Functional Tests

`test/panel-layout.test.ts` (source-read pins, as `listening-billing.test.ts`
does):

- The sidebar rule carries `bottom: var(--avc-panel-bottom)` rather than
  `bottom: 0`.
- The collapse control exists in `buildShell`, is labelled distinctly from the
  close control, and calls neither `hideAgent` nor `finishWord`.
- `.avc-agent-sidebar.avc-collapsed` sets the rail width and hides the panel
  body.
- The collapsed flag is read on mount alongside the panel width.

## Smoke Tests

- `npm run typecheck`, `npm run test:unit`, `node build.mjs` all clean, with the
  committed bundles reproducible.

## E2E Tests

`e2e/panel-layout.mjs`, headed, against the served-YouTube harness from
`e2e/youtube-session.mjs` (a real content script on a real player container, with
a stand-in control bar pinned bottom-right where Netflix's is):

- With the panel expanded, a click at the centre of the host control cluster
  reaches the host element, not the panel.
- The panel's own controls still take clicks (the chat input focuses).
- Collapsing leaves the card mounted: the word block is still present after
  expanding again.
- While collapsed, a click anywhere in the old panel area except the rail
  reaches the page.

Netflix itself is not driven: it needs an account and a licensed stream, and its
DOM is not ours to depend on. The stand-in control bar is positioned from
Netflix's measured control-bar geometry (bottom 0, right 0, ~140px tall).

## Manual / cURL Tests

N/A for cURL. Manual pass on Netflix by the maintainer, since only a real
account can render the real control cluster:

1. Play any title with the panel open in Ambient mode.
2. Confirm the subtitles, speed, next-episode and fullscreen buttons are all
   clickable without closing the panel.
3. Collapse the panel mid-card, use the caption menu, expand, and confirm the
   same card is still there.
