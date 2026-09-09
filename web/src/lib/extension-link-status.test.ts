import { describe, expect, it } from "vitest";
import {
  connectionView,
  retryDelayMs,
  shouldAutoRetry,
  tokenErrorFor,
  type TokenError,
} from "./extension-link-status";

describe("tokenErrorFor", () => {
  it("names a lost session and what fixes it", () => {
    const err = tokenErrorFor(401);
    expect(err.kind).toBe("signed_out");
    expect(err.message).toMatch(/sign in again/i);
  });

  it("treats 5xx as temporary and says it is retrying", () => {
    for (const status of [500, 502, 503]) {
      const err = tokenErrorFor(status);
      expect(err.kind, String(status)).toBe("unavailable");
      expect(err.message).toContain(String(status));
      expect(err.message).toMatch(/retrying/i);
    }
  });

  // The whole point of the reason: the next QA report can say which failure.
  it("names any other status rather than hiding it", () => {
    const err = tokenErrorFor(418);
    expect(err.kind).toBe("http");
    expect(err.message).toContain("418");
  });

  it("separates a thrown fetch from an HTTP answer", () => {
    const err = tokenErrorFor(null);
    expect(err.kind).toBe("network");
    expect(err.status).toBeNull();
  });

  it("never uses long dashes in learner-facing copy", () => {
    for (const status of [401, 403, 418, 500, 503, null]) {
      expect(tokenErrorFor(status).message).not.toMatch(/[—–]/);
    }
  });
});

describe("automatic retry budget", () => {
  const unavailable = tokenErrorFor(503);
  const signedOut = tokenErrorFor(401);
  const network = tokenErrorFor(null);

  it("retries what retrying can fix", () => {
    expect(shouldAutoRetry(unavailable, 0)).toBe(true);
    expect(shouldAutoRetry(network, 0)).toBe(true);
  });

  it("never retries a signed-out session", () => {
    // Each attempt is a wasted KV round-trip, and #123 is what a loose retry
    // loop costs on this endpoint.
    expect(shouldAutoRetry(signedOut, 0)).toBe(false);
  });

  it("stops once the budget is spent", () => {
    let attempts = 0;
    while (shouldAutoRetry(unavailable, attempts)) attempts++;
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThanOrEqual(4);
    expect(retryDelayMs(attempts)).toBeUndefined();
  });

  it("backs off between attempts", () => {
    const delays = [];
    for (let i = 0; retryDelayMs(i) !== undefined; i++) delays.push(retryDelayMs(i)!);
    expect(delays.length).toBeGreaterThan(1);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });
});

describe("connectionView", () => {
  const failed: TokenError = tokenErrorFor(503);

  it("reads healthy when the extension answered and the token minted", () => {
    const view = connectionView({ presence: "installed", tokenState: "ok", tokenError: null, syncedWords: 1234 });
    expect(view.tone).toBe("ok");
    expect(view.label).toContain("Extension connected");
    expect(view.label).toContain("1,234");
    expect(view.detail).toBeNull();
    expect(view.canRetry).toBe(false);
  });

  // The bug: a linked, syncing extension told the learner the link failed.
  it("never claims a broken link while the extension is answering", () => {
    const view = connectionView({ presence: "installed", tokenState: "failed", tokenError: failed });
    expect(view.label).not.toMatch(/could not link/i);
    expect(view.label).toContain("Extension connected");
    expect(view.detail).toBe(failed.message);
    expect(view.canRetry).toBe(true);
  });

  it("stays fully healthy when the extension says it already holds a token", () => {
    const view = connectionView({
      presence: "installed",
      tokenState: "failed",
      tokenError: failed,
      extensionLinked: true,
      syncedWords: 20,
    });
    expect(view.tone).toBe("ok");
    expect(view.detail).toMatch(/already linked and syncing/i);
  });

  // An older extension build sends no `linked` field; unknown must not read as
  // "not linked".
  it("falls back to its own token state when the extension is silent about linking", () => {
    const unknown = connectionView({ presence: "installed", tokenState: "failed", tokenError: failed });
    const notLinked = connectionView({
      presence: "installed",
      tokenState: "failed",
      tokenError: failed,
      extensionLinked: false,
    });
    expect(unknown).toEqual(notLinked);
  });

  it("offers install help only when nothing answered", () => {
    const view = connectionView({ presence: "missing", tokenState: "idle", tokenError: null });
    expect(view.label).toMatch(/not installed/i);
    expect(view.showInstallHelp).toBe(true);
    expect(view.canRetry).toBe(false);
  });

  it("keeps the could-not-link copy for the state that earns it", () => {
    const view = connectionView({ presence: "checking", tokenState: "failed", tokenError: failed });
    expect(view.label).toMatch(/could not link/i);
    expect(view.detail).toBe(failed.message);
    expect(view.canRetry).toBe(true);
  });

  it("says it is checking while nothing has happened yet", () => {
    const view = connectionView({ presence: "checking", tokenState: "idle", tokenError: null });
    expect(view.tone).toBe("off");
    expect(view.label).toMatch(/checking/i);
  });
});
