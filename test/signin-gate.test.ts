import { describe, expect, it } from "vitest";
import {
  ACCOUNT_GATE_VERSION,
  LISTEN_SIGNIN_REQUIRED,
  SIGNIN_GATE_COPY,
  isBeforeAccountGate,
  isSignedIn,
  shouldShowSigninChip,
  signinStartPath,
  type SigninChipInput,
} from "../src/lib/signin-gate";

const baseChip: SigninChipInput = {
  signedIn: false,
  dismissed: false,
  topFrame: true,
  hasPlayer: true,
  siteEnabled: true,
};

describe("account state", () => {
  it("treats only a non-empty string as signed in", () => {
    expect(isSignedIn("token")).toBe(true);
    expect(isSignedIn("")).toBe(false);
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn(undefined)).toBe(false);
    expect(isSignedIn(42)).toBe(false);
  });
});

describe("sign-in chip gate", () => {
  it("shows for an ordinary signed-out player", () => {
    expect(shouldShowSigninChip(baseChip)).toBe(true);
  });

  it("stays away when signed in", () => {
    expect(shouldShowSigninChip({ ...baseChip, signedIn: true })).toBe(false);
  });

  it("stays away after a dismissal", () => {
    expect(shouldShowSigninChip({ ...baseChip, dismissed: true })).toBe(false);
  });

  it("mounts in the top frame only", () => {
    expect(shouldShowSigninChip({ ...baseChip, topFrame: false })).toBe(false);
  });

  it("needs a player on the page", () => {
    expect(shouldShowSigninChip({ ...baseChip, hasPlayer: false })).toBe(false);
  });

  it("respects a site the learner turned off", () => {
    expect(shouldShowSigninChip({ ...baseChip, siteEnabled: false })).toBe(false);
  });
});

describe("update migration version", () => {
  it("flags builds before the gate", () => {
    expect(isBeforeAccountGate("0.7.1")).toBe(true);
    expect(isBeforeAccountGate("0.7.0")).toBe(true);
    expect(isBeforeAccountGate("0.6.9")).toBe(true);
    expect(isBeforeAccountGate("0.7.1.4")).toBe(true);
  });

  it("does not flag the gate build or anything newer", () => {
    expect(isBeforeAccountGate(ACCOUNT_GATE_VERSION)).toBe(false);
    expect(isBeforeAccountGate("0.7.2.0")).toBe(false);
    expect(isBeforeAccountGate("0.8.0")).toBe(false);
    expect(isBeforeAccountGate("1.0.0")).toBe(false);
  });

  it("treats a malformed version as not older", () => {
    expect(isBeforeAccountGate("")).toBe(false);
    expect(isBeforeAccountGate("0.7.x")).toBe(false);
    expect(isBeforeAccountGate("0.7.-1")).toBe(false);
  });
});

describe("copy", () => {
  it("has no em or en dash in anything a learner reads", () => {
    for (const [key, value] of Object.entries(SIGNIN_GATE_COPY)) {
      expect(value, key).not.toMatch(/[\u2013\u2014]/);
    }
    expect(LISTEN_SIGNIN_REQUIRED).not.toMatch(/[\u2013\u2014]/);
  });

  it("names the free account and the fix when Listening is refused", () => {
    expect(LISTEN_SIGNIN_REQUIRED).toContain("free account");
    expect(LISTEN_SIGNIN_REQUIRED).toContain("/start");
  });

  it("builds a start path with an encoded surface", () => {
    expect(signinStartPath("content_chip")).toBe("/start?from=content_chip");
    expect(signinStartPath("a b")).toBe("/start?from=a%20b");
  });
});
