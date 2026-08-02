import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regression pin for the 2x listening overcharge.
//
// A cloud Listening session runs one of two pipelines, and each has its OWN
// meter:
//   cached path   -> POST /v1/transcript/transcribe, which charges the real
//                    audio duration of every chunk it transcribes
//   realtime path -> audio goes straight to OpenAI, the backend never sees it,
//                    so POST /v1/usage/heartbeat charges 5 min of wall clock
//                    every 5 minutes
//
// start() used to run the chunk timer AND startHeartbeat() on the cached path,
// so ~5 minutes of playback was billed twice — once as wall clock, once as
// chunk audio. An "8 hour" free month therefore died at about 4 hours, and
// cache hits (which cost nothing to serve) still burned quota.
//
// Read from source rather than imported: offscreen.ts is an MV3 entry that
// registers chrome.runtime listeners at module scope and reaches for
// getUserMedia/AudioContext/WebSocket, none of which exist under node. Same
// approach, and the same reason, as web/src/lib/middleware-matcher.test.ts.
const source = readFileSync(
  fileURLToPath(new URL("../src/entries/offscreen.ts", import.meta.url)),
  "utf8"
);

/** Body of a top-level `function <name>(...) { ... }`, brace-matched. The
 * parameter list is skipped by paren-matching first — `start()` destructures
 * its argument, so the first `{` after the name belongs to the params. */
function functionBody(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`no function ${name} in offscreen.ts`);

  const parenOpen = source.indexOf("(", start);
  let parens = 0;
  let parenClose = -1;
  for (let i = parenOpen; i < source.length; i++) {
    if (source[i] === "(") parens++;
    else if (source[i] === ")") {
      parens--;
      if (parens === 0) {
        parenClose = i;
        break;
      }
    }
  }
  if (parenClose === -1) throw new Error(`unbalanced parens in ${name}`);

  const open = source.indexOf("{", parenClose);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

describe("listening meters", () => {
  it("never bills wall clock on the cached path", () => {
    const body = functionBody("startHeartbeat");
    // The guard is what makes double-billing unreachable no matter who calls it.
    expect(body).toMatch(/if\s*\(\s*session\.useCache\s*\)\s*return/);
  });

  it("still bills wall clock on the realtime path", () => {
    // Only bails for BYO keys and cached sessions — a plain cloud realtime
    // session must still arm the interval.
    expect(functionBody("startHeartbeat")).toMatch(/setInterval/);
    expect(functionBody("flushListening")).toContain("/v1/usage/heartbeat");
  });

  it("reports measured time, never a flat interval's worth", () => {
    const flush = functionBody("flushListening");
    // The original bug: `minutes: 5` every tick regardless of how much of that
    // interval was actually watched.
    expect(source).not.toMatch(/minutes:\s*5\b/);
    expect(flush).toMatch(/pendingBillMs/);
    expect(flush).toMatch(/60_000|60000/);
  });

  it("banks elapsed time when playback pauses or resumes", () => {
    // Sampling `playbackPaused` at the tick boundary meant playing 4:59 then
    // pausing cost nothing, and resuming just before a tick cost five minutes.
    const onUpdate = functionBody("onPlaybackUpdate");
    expect(onUpdate).toMatch(/setListeningClock\(session,\s*!paused\)/);
    expect(functionBody("accrueListening")).toMatch(/pendingBillMs\s*\+=/);
  });

  it("flushes the partial interval on stop and on a mode switch", () => {
    expect(functionBody("stop")).toMatch(/flushListening\(session,\s*true\)/);
    expect(functionBody("applyCacheMode")).toMatch(/flushListening\(session,\s*true\)/);
  });

  it("puts time back when a report fails", () => {
    // Otherwise a transient network error silently hands out free minutes.
    expect(functionBody("flushListening")).toMatch(/pendingBillMs\s*\+=\s*sentMs/);
  });

  it("drops a realtime connect that lost its race with a mode switch", () => {
    const body = functionBody("connectWS");
    expect(body).toMatch(/modeGeneration/);
    expect(body).toMatch(/await getWsKey\(session\);[\s\S]{0,200}?stale\(\)/);
  });

  it("does not start the heartbeat twice for one session", () => {
    const body = functionBody("startHeartbeat");
    expect(body).toMatch(/if\s*\(\s*session\.heartbeat\s*\)\s*return/);
  });

  it("switches meters when the cache key resolves mid-session", () => {
    // The key often lands after Listening starts. applyCacheMode is what keeps
    // the timers and the meter consistent with the mode; without it the session
    // buffered PCM that nothing flushed while the heartbeat kept billing.
    const body = functionBody("applyCacheMode");
    expect(body).toContain("clearInterval(session.heartbeat)");
    expect(body).toContain("chunkTimer");
    expect(source).toMatch(/session\.useCache\s*=\s*session\.auth\.kind[\s\S]{0,400}?applyCacheMode\(session\)/);
  });

  it("routes both start paths through applyCacheMode", () => {
    const body = functionBody("start");
    expect(body).toContain("applyCacheMode(session)");
    // A direct startHeartbeat() in start() would bypass the mode reconciliation.
    expect(body).not.toContain("startHeartbeat(");
  });
});
