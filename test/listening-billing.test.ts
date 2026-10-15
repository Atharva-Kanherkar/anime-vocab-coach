import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { privateSessionKey } from "../src/lib/session-key";

// Listening Mode metering, after the ISO 25010 security audit (2026-10).
//
// A signed-in (cloud) session used to run one of two pipelines with two
// meters: chunks through POST /v1/transcript/transcribe, billed by the server
// on real audio length, or, with no episode key, a realtime socket straight to
// OpenAI billed by this document's own heartbeat. The heartbeat was the only
// meter on that path, so a modified client could skip it and transcribe for
// free. Cloud sessions now always take the chunk path (a private `sess:` key
// stands in until the episode key arrives); the realtime socket is BYO-key
// only, where the learner pays OpenAI directly.
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
  it("puts every signed-in session on the server-metered path", () => {
    expect(functionBody("start")).toMatch(/const useCache = auth\.kind === "cloud";/);
  });

  it("never asks the backend for a realtime token or reports its own minutes", () => {
    expect(source).not.toContain("/v1/session");
    expect(source).not.toContain("/v1/usage/heartbeat");
    expect(functionBody("getWsKey")).toMatch(/session\.auth\.kind === "byo"/);
  });

  it("falls back to the private key, not a realtime socket, when the episode key goes away", () => {
    expect(source).toMatch(/const newKey = msg\.cacheKey \|\| session\.privateKey;/);
    expect(source).toMatch(/session\.useCache = session\.auth\.kind === "cloud";/);
  });

  it("makes private keys the backend accepts as transcribe-only", () => {
    const backendShape = /^sess:[A-Za-z0-9_-]{8,64}:(?:ja|en)$/;
    expect(privateSessionKey("ja")).toMatch(backendShape);
    expect(privateSessionKey("en")).toMatch(backendShape);
    expect(privateSessionKey("ja")).not.toBe(privateSessionKey("ja"));
  });

  it("bounds every chunk upload with a timeout", () => {
    expect(functionBody("flushChunk")).toMatch(/signal:\s*AbortSignal\.timeout\(/);
  });
});
