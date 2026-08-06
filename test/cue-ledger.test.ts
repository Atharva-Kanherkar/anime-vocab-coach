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
    expect(background).toContain("deliverTranscript(msg.tabId!, msg.text!, msg.start)");
    expect(content).toContain('emittedCueKeys.remember(`${msg.start}:${rawTranscript}`)');
    expect(offscreen).toContain("session.sentCues.clear()");
  });
});
