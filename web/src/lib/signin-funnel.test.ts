import { describe, expect, it } from "vitest";
import {
  SIGNIN_FUNNEL_EVENTS,
  SIGNIN_SURFACES,
  isSigninFunnelEvent,
  isSigninSurface,
  normalizeSigninSurface,
} from "./signin-funnel";
import { TRACKABLE_EVENTS } from "./track-events";

describe("sign-in funnel allowlist", () => {
  it("accepts every declared event and nothing else", () => {
    for (const event of SIGNIN_FUNNEL_EVENTS) {
      expect(isSigninFunnelEvent(event)).toBe(true);
      expect(TRACKABLE_EVENTS as readonly string[]).toContain(event);
    }
    expect(isSigninFunnelEvent("signin_bogus")).toBe(false);
    expect(isSigninFunnelEvent(42)).toBe(false);
  });

  it("accepts every declared surface and normalizes the rest to empty", () => {
    for (const surface of SIGNIN_SURFACES) {
      expect(isSigninSurface(surface)).toBe(true);
      expect(normalizeSigninSurface(surface)).toBe(surface);
    }
    expect(normalizeSigninSurface("ext_popup")).toBe("");
    expect(normalizeSigninSurface(null)).toBe("");
    expect(normalizeSigninSurface(7)).toBe("");
  });
});
