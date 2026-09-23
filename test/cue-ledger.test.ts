import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CueLedger } from "../src/lib/cue-ledger";

describe("CueLedger", () => {
  it("emits a cue once while it is retained", () => {
    const ledger = new CueLedger();
    expect(ledger.remember("1:hello")).toBe(true);
    expect(ledger.remember("1:hello")).toBe(false);
  });

  it("evicts only the oldest cue at capacity", () => {
    const ledger = new CueLedger(3);
    expect(ledger.remember("a")).toBe(true);
    expect(ledger.remember("b")).toBe(true);
    expect(ledger.remember("c")).toBe(true);
    expect(ledger.remember("d")).toBe(true);

    expect(ledger.size).toBe(3);
    expect(ledger.remember("d")).toBe(false);
    expect(ledger.remember("c")).toBe(false);
    expect(ledger.remember("a")).toBe(true);
  });

  it("resets between listening sessions", () => {
    const ledger = new CueLedger();
    ledger.remember("1:hello");
    ledger.clear();
    expect(ledger.size).toBe(0);
    expect(ledger.remember("1:hello")).toBe(true);
  });

  it("relays cache timestamps into the content-side ledger", () => {
    const offscreen = readFileSync(
      fileURLToPath(new URL("../src/entries/offscreen.ts", import.meta.url)),
      "utf8"
    );
    const background = readFileSync(
      fileURLToPath(new URL("../src/entries/background.ts", import.meta.url)),
      "utf8"
    );
    const content = readFileSync(
      fileURLToPath(new URL("../src/entries/content.ts", import.meta.url)),
      "utf8"
    );

    expect(offscreen).toMatch(/type:\s*"avc-transcript"[\s\S]{0,100}?start:\s*seg\.start/);
    expect(background).toContain("deliverTranscript(msg.tabId!, msg.text!, msg.start, msg.end)");
    expect(content).toContain('emittedCueKeys.remember(`${start}:${rawTranscript}`)');
    expect(content).toMatch(/if \(next !== cacheKey\)[\s\S]{0,260}?emittedCueKeys\.clear\(\)/);
    expect(offscreen).toContain("session.sentCues.clear()");
    expect(content).toContain("cachePollGeneration !== generation");
    expect(content).toContain("if (cachePollInFlight === generation) return");
    expect(content).toContain("if (cachePollInFlight === generation) cachePollInFlight = null");
    expect(content).toMatch(/settings = await storage\.getSettings\(\);\s+if \(stale\(\)\) return/);
    expect(content).toMatch(/await lookupTranscript[\s\S]{0,300}?if \(stale\(\)\) return/);
    // Every cached segment is re-checked against the generation before it is
    // emitted; onLine itself returns at once and never waits on a card.
    expect(content).toMatch(/for \(const seg of result\.segments\) \{\s+if \(stale\(\)\) return/);
    expect(offscreen).toContain("session.cacheKey !== requestKey");
    expect(offscreen).toContain("session.modeGeneration !== generation");
    expect(offscreen).toContain("session.transcribingGeneration === session.modeGeneration");
    expect(offscreen).toMatch(
      /if \(session\.transcribingGeneration === generation\) \{\s+session\.transcribingGeneration = null;/
    );
    // A tick that landed mid-request flushes on return, only for that generation.
    expect(offscreen).toMatch(/session\.flushDeferred && session\.active && session\.modeGeneration === generation/);
  });
});
