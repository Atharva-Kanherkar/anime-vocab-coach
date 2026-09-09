import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Wiring pins for issue #133. The hook is postMessage- and DOM-bound and the
// bridge is a content script, so neither imports under node; their decisions
// live in extension-link-status.ts (unit-tested) and these assertions pin the
// call sites. Same approach, same reason, as middleware-matcher.test.ts.
const hook = readFileSync(
  fileURLToPath(new URL("./use-extension-link.ts", import.meta.url)),
  "utf8"
);
const bridge = readFileSync(
  fileURLToPath(new URL("../../../src/entries/sync-bridge.ts", import.meta.url)),
  "utf8"
);

describe("token failures never touch presence", () => {
  it("no longer has a state that means both things", () => {
    // The bug was one LinkState carrying presence AND token health, so a mint
    // failure rendered "Could not link extension".
    expect(hook).not.toMatch(/setLinkState\(/);
    expect(hook).toMatch(/function setPresence/);
    expect(hook).toMatch(/function setToken/);
  });

  it("writes presence only from presence events", () => {
    const callers = [...hook.matchAll(/^.*setPresence\((?!next)/gm)].map((m) => m[0].trim());
    expect(callers.length).toBeGreaterThan(0);
    for (const line of callers) {
      expect(line, line).not.toMatch(/token/i);
    }
  });

  it("classifies the mint failure instead of swallowing it", () => {
    expect(hook).toMatch(/tokenErrorFor\(/);
    expect(hook).toMatch(/setToken\("failed"/);
    expect(hook).toMatch(/scheduleRetry\(/);
  });

  it("keeps one mint in flight, which is the #123 contract", () => {
    expect(hook).toMatch(/mintInFlight/);
    expect(hook).toMatch(/if \(tokenBroadcast && !force\) return;/);
  });
});

describe("the bridge reports its own link state", () => {
  it("announces linked from the stored sync token", () => {
    expect(bridge).toMatch(/type: "avc-ext-present", linked/);
    expect(bridge).toMatch(/typeof r\?\.syncToken === "string"/);
  });

  it("announces presence before it asks storage anything", () => {
    const fn = bridge.slice(bridge.indexOf("function announceExtension"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    expect(body.indexOf('type: "avc-ext-present" }')).toBeLessThan(body.indexOf("chrome.storage.local.get"));
  });

  it("survives storage being unavailable", () => {
    const fn = bridge.slice(bridge.indexOf("function announceExtension"));
    expect(fn.slice(0, fn.indexOf("\n}"))).toMatch(/catch/);
  });
});

describe("the page tolerates an extension that does not send linked", () => {
  it("only trusts a real boolean", () => {
    expect(hook).toMatch(/typeof data\.linked === "boolean"/);
  });
});
