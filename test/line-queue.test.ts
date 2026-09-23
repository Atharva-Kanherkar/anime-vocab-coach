import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Review of #151. The card pipeline's queue once held only the newest line, so
// the middle sentences of a transcript (and of a cached chunk) never reached
// recordSeen. And a Lens judgment was matched by substring for the rest of the
// session, silencing cards for dialogue that simply came round again.
const content = readFileSync(fileURLToPath(new URL("../src/entries/content.ts", import.meta.url)), "utf8");

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

describe("card pipeline queue", () => {
  it("queues every line in order instead of overwriting one slot", () => {
    expect(functionBody(content, "onLine")).toMatch(/pendingLines\.push\(/);
    expect(functionBody(content, "drainLines")).toMatch(/pendingLines\.shift\(\)/);
    expect(content).not.toMatch(/queuedLine/);
  });

  it("counts a line as seen before deciding it is too old to card", () => {
    const body = functionBody(content, "processLine");
    const seen = body.indexOf("await storage.recordSeen(");
    const newest = body.indexOf("if (pendingLines.length)");
    const pick = body.indexOf("await pickTargetSmart(");
    expect(seen).toBeGreaterThan(-1);
    expect(newest).toBeGreaterThan(seen);
    // Before the pick, never after it: lines outpace a pick's round-trip.
    expect(newest).toBeLessThan(pick);
    expect(body.indexOf("pendingLines.length", pick)).toBe(-1);
  });
});

describe("Lens judgments", () => {
  it("stand down only the card of the render they were made on", () => {
    const body = functionBody(content, "processLine");
    expect(body).toMatch(/judgedLensSeqs\.has\(lineLensSeq\)/);
    expect(body).not.toMatch(/\.includes\(normalized\)/);
    expect(functionBody(content, "renderLens")).toMatch(/judgedLensSeqs\.add\(seq\)/);
  });

  it("tie a transcript's sentences to the render of the whole utterance", () => {
    expect(functionBody(content, "handleTranscript")).toMatch(/onLine\(seg, context, \{ lens: false, lensSeq: seq \}\)/);
  });
});
