import { describe, expect, it } from "vitest";
import {
  PRO_FUNNEL_EVENTS,
  PRO_SURFACES,
  isProFunnelEvent,
  normalizeProSurface,
} from "./pro-funnel";
import { isTrackableEvent } from "./track-events";

describe("Pro funnel allowlists (#162)", () => {
  it("accepts exactly the three funnel events", () => {
    for (const e of PRO_FUNNEL_EVENTS) expect(isProFunnelEvent(e)).toBe(true);
    for (const e of ["upgrade_prompt_shown", "PRO_PROMPT_SHOWN", "", null, 3, {}]) {
      expect(isProFunnelEvent(e)).toBe(false);
    }
  });

  it("puts every funnel event on the /api/track allowlist", () => {
    for (const e of PRO_FUNNEL_EVENTS) expect(isTrackableEvent(e)).toBe(true);
  });

  it("keeps an allowlisted surface and blanks anything else", () => {
    for (const s of PRO_SURFACES) expect(normalizeProSurface(s)).toBe(s);
    for (const s of ["APP_HEADER", " app_header", "app_header ", "x".repeat(300), "evil", null, 1, [], undefined]) {
      expect(normalizeProSurface(s)).toBe("");
    }
  });
});
