import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Wiring pins for the 2026-09-09 YouTube QA round: issues #125 (playlist
// advance kept the previous clip's card and cues), #126 (a refresh left
// Listening live with the Copilot gone) and #127 (pausing cleared the card).
//
// Read from source rather than imported, for the reason listening-billing.test.ts
// gives: these are MV3 entries and DOM modules that register chrome.* listeners
// and touch window at module scope, none of which exist under node. The logic
// that CAN be exercised directly is covered in pausable-timer.test.ts and
// caption-status.test.ts; these assertions pin the call sites those depend on.
function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

const youtube = read("../src/lib/adapters/youtube.ts");
const content = read("../src/entries/content.ts");
const panel = read("../src/lib/agent-panel.ts");
const background = read("../src/entries/background.ts");

/** Body of a top-level `function <name>(...) { ... }`, brace-matched. */
function functionBody(source: string, name: string): string {
  const start = source.search(new RegExp(`function ${name}\\s*\\(`));
  if (start < 0) throw new Error(`no function ${name}`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("#125 playlist advance drops the previous video's context", () => {
  const drop = functionBody(youtube, "dropCuesFromOtherVideo");

  it("compares the loaded cues against the URL's video id", () => {
    expect(drop).toMatch(/urlVideoId\(\)/);
    expect(drop).toMatch(/id === currentVideoId/);
  });

  it("clears both cue lists, the last-cue slot, and the caption report", () => {
    expect(drop).toMatch(/targetCues = \[\]/);
    expect(drop).toMatch(/contextCues = \[\]/);
    expect(drop).toMatch(/lastCueKey = ""/);
    expect(drop).toMatch(/resetCaptions\(\)/);
  });

  // The bug was cues outliving their video: the new clip's clock read against
  // the old clip's cues, so a card showed a word from the previous video.
  it("runs the check before any cue is emitted", () => {
    const emit = functionBody(youtube, "onTimeUpdate");
    const guard = emit.indexOf("dropCuesFromOtherVideo()");
    const cue = emit.indexOf("cueAt(");
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(cue);
  });

  it("also re-checks off the timeupdate path, for an advance while paused", () => {
    // The 2s video-attach poll and the DOM caption fallback both call it, so a
    // paused advance (no timeupdate) still drops the stale cues.
    expect(youtube.match(/dropCuesFromOtherVideo\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("dismisses the open card and the queued line on a session change", () => {
    const reset = content.slice(content.indexOf("if (sid !== lastSessionId)"));
    const body = reset.slice(0, reset.indexOf("}, 2000);"));
    expect(body).toMatch(/overlay\.dismissAgent\(\)/);
    expect(body).toMatch(/queuedLine = null/);
    expect(body).toMatch(/hideLens\(\)/);
    expect(body).toMatch(/resetCaptions\(\)/);
    expect(body).toMatch(/captionNoticeShown = false/);
  });
});

describe("#126 a reload restores the whole session, not half of it", () => {
  it("keeps per-tab Copilot state beside the listening state", () => {
    expect(background).toMatch(/copilotTabs/);
    expect(background).toMatch(/chrome\.storage\.session/);
  });

  it("answers a content script that asks what its own tab was doing", () => {
    const handler = background.slice(background.indexOf('msg.type === "avc-session-state"'));
    const body = handler.slice(0, handler.indexOf("\n  }"));
    // The asking tab does not know its own id; the sender does.
    expect(body).toMatch(/sender\.tab\?\.id/);
    expect(body).toMatch(/getListening\(\)/);
    expect(body).toMatch(/getCopilot\(\)/);
  });

  it("forgets a closed tab's Copilot state", () => {
    const removed = background.slice(background.indexOf("chrome.tabs.onRemoved.addListener"));
    expect(removed.slice(0, removed.indexOf("\n});"))).toMatch(/setCopilotTab\(tabId, false\)/);
  });

  it("restores both sides on boot", () => {
    const restore = functionBody(content, "restoreTabSession");
    expect(restore).toMatch(/avc-session-state/);
    expect(restore).toMatch(/ensureAgentMounted\(\)/);
    expect(restore).toMatch(/listeningActive = true/);
    expect(restore).toMatch(/startCachePolling\(\)/);
    expect(restore).toMatch(/startPlaybackRelay\(\)/);
    expect(content).toMatch(/void restoreTabSession\(\)/);
  });

  it("reports panel visibility from the page, whoever opened or closed it", () => {
    expect(panel).toMatch(/function announceVisibility/);
    expect(functionBody(panel, "ensureAgentMounted")).toMatch(/announceVisibility\(true\)/);
    expect(functionBody(panel, "hideAgent")).toMatch(/announceVisibility\(false\)/);
    expect(content).toMatch(/avc-copilot-state/);
  });
});

describe("#127 a paused video holds its card", () => {
  it("freezes both dismissal clocks on a learner pause", () => {
    expect(functionBody(panel, "freezeAutoTimers")).toMatch(/autoTimer\.freeze\(\)/);
    expect(functionBody(panel, "freezeAutoTimers")).toMatch(/autoTimerMax\.freeze\(\)/);
    expect(functionBody(panel, "thawAutoTimers")).toMatch(/autoTimer\.thaw\(\)/);
  });

  it("attaches the pause and play listeners to the card's video", () => {
    const present = functionBody(panel, "presentWord");
    expect(present).toMatch(/on\("pause",/);
    expect(present).toMatch(/on\("play",/);
    expect(present).toMatch(/thawAutoTimers\(\)/);
  });

  // The listeners exist only to feed one card's hold, so they must not outlive
  // it — a previous video's events reaching the next card's hold is the same
  // bleed as #125.
  it("detaches them when the card ends", () => {
    const clear = functionBody(panel, "clearWordTimers");
    expect(clear).toMatch(/for \(const off of videoWatchers\) off\(\);/);
    expect(clear).toMatch(/videoWatchers = \[\]/);
    expect(functionBody(panel, "presentWord")).toMatch(/videoWatchers\.push/);
  });

  // Focus mode pauses the video itself. That pause must not freeze the clock,
  // or a focus card would never time out on its own.
  it("does not mistake its own focus-mode pause for a learner pause", () => {
    const present = functionBody(panel, "presentWord");
    // Taking the hold IS the pause, so the two can never fall out of step.
    expect(present).toMatch(/cardHold\.hold\(video, \(\) => video\.pause\(\)\)/);
    // Our own pause returns before the clock is frozen.
    expect(present).toMatch(/if \(cardHold\.noticePause\(\)\) return;/);
  });

  it("holds a card that opens on an already-paused frame", () => {
    expect(functionBody(panel, "presentWord")).toMatch(
      /if \(video\.paused && !cardHold\.owned\(\)\) freezeAutoTimers\(\)/
    );
  });

  it("keeps the timers off setTimeout so freezing is possible at all", () => {
    expect(panel).toMatch(/new PausableTimer\(\)/);
    expect(panel).not.toMatch(/autoTimer = setTimeout/);
  });
});

// Review follow-ups: two paths the first pass at #125 and #127 left open.
describe("#127 a learner's pause outlives the card it was made for", () => {
  // Holding the card through a pause is only half the fix. The learner paused
  // to study; grading the card they paused for must not snap the video back to
  // playing under them.
  // Ownership lives in one place now (PlaybackHold), so the learner pausing,
  // seeking from a stop and pressing play are all the same answer to the same
  // question. test/playback-ownership.test.ts drives that behaviour against a
  // spec-shaped fake video; these pin the wiring.
  it("does not resume a video the learner paused", () => {
    const resume = functionBody(panel, "resumeVideoIfNeeded");
    expect(resume).toMatch(/cardHold\.release\(\)/);
  });

  it("records the learner's pause where it freezes the clock", () => {
    const present = functionBody(panel, "presentWord");
    const pause = present.slice(present.indexOf('on("pause"'));
    const body = pause.slice(0, pause.indexOf("});"));
    // Our own pause returns before this line, so only a learner pause freezes.
    expect(body).toMatch(/freezeAutoTimers\(\)/);
    expect(body.indexOf("cardHold.noticePause()")).toBeLessThan(
      body.indexOf("freezeAutoTimers()")
    );
  });

  it("clears the hold when the learner gives playback back", () => {
    const present = functionBody(panel, "presentWord");
    const play = present.slice(present.indexOf('on("play"'));
    const body = play.slice(0, play.indexOf("});"));
    expect(body).toMatch(/cardHold\.noticePlay\(video\.paused\)/);
    expect(body).toMatch(/thawAutoTimers\(\)/);
  });
});

describe("#125 a line in flight belongs to the video it came from", () => {
  // Dropping `queuedLine` covers a line that never started. One already past
  // that gate keeps awaiting word extraction, a target pick and stats, and used
  // to card against whatever video was on screen when it landed.
  // The 2s session watcher is too slow to be the gate: a line can finish well
  // inside those 2 seconds, so the check reads the page's identity live.
  it("compares against a live session id, not the watcher's poll", () => {
    const body = functionBody(content, "currentSessionId");
    expect(body).toMatch(/sessionIdentity\(/);
    const stale = functionBody(content, "processLine");
    expect(stale).toMatch(/currentSessionId\(\) === lineSessionId/);
  });

  it("reads the line's session id once, at the top of processLine", () => {
    const body = functionBody(content, "processLine");
    expect(body).toMatch(/const lineSessionId = currentSessionId\(\)/);
    // Captured before the first suspension point, so it names the video the
    // line was spoken on rather than whatever is playing after the next await.
    expect(body.indexOf("const lineSessionId = currentSessionId()")).toBeLessThan(
      body.indexOf("await storage.getSettings()")
    );
  });

  it("re-checks it after every await that can outlive the video", () => {
    const body = functionBody(content, "processLine");
    expect(body.match(/staleSession\(\)/g)?.length).toBeGreaterThanOrEqual(5);
    // Nothing may reach the screen after a change: not the card, not the Lens.
    const lens = body.indexOf("showLensLine(");
    const card = body.indexOf("await handleCard(");
    expect(body.lastIndexOf("staleSession()", lens)).toBeGreaterThan(-1);
    expect(body.lastIndexOf("staleSession()", card)).toBeGreaterThan(-1);
  });
});
