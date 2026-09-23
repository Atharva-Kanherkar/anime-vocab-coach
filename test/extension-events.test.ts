import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXTENSION_EVENTS,
  EXTENSION_MILESTONE_STORAGE_KEY,
  TRACK_EXTENSION_EVENT_MESSAGE,
  trackExtensionEvent,
  trackExtensionMilestone,
} from "../src/lib/extension-events";
import { EXTENSION_EVENTS as SERVER_EXTENSION_EVENTS } from "../web/src/lib/extension-funnel";
import { ownedWebUrl } from "../src/config";

describe("extension funnel events", () => {
  const state: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", getManifest: () => ({ version: "0.5.7" }) },
      storage: {
        local: {
          get: vi.fn(async () => ({ ...state })),
          set: vi.fn(async (value: Record<string, unknown>) => Object.assign(state, value)),
        },
      },
    });
  });

  it("keeps client and server allowlists identical", () => {
    expect(EXTENSION_EVENTS).toEqual(SERVER_EXTENSION_EVENTS);
  });

  it("tags extension-owned links with stable campaigns", () => {
    expect(ownedWebUrl("/app#settings", "popup_settings")).toBe(
      "https://animevocab.com/app?utm_source=animevocab_extension&utm_medium=extension&utm_campaign=popup_settings#settings"
    );
  });

  it("sends lifecycle milestones only once per install", async () => {
    expect(await trackExtensionMilestone("first_card_created")).toBe(true);
    expect(await trackExtensionMilestone("first_card_created")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state[EXTENSION_MILESTONE_STORAGE_KEY]).toEqual({ first_card_created: true });
  });

  /**
   * The biggest callers of this beacon — the in-page card overlay, and
   * storage.ts's judgeWord / recordCardShown — run in a CONTENT SCRIPT, at the
   * watched page's origin. A fetch from there to animevocab.com is
   * cross-origin, and the endpoint sends no CORS headers, so the request dies
   * after the preflight with nothing logged anywhere. e2e/learning-loop.mjs
   * measures that against a real server; this pins the fix that follows from
   * it, because the milestone is marked as sent BEFORE the send, so a dropped
   * beacon is never retried.
   */
  it("relays through the service worker when it is not the service worker", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", sendMessage },
      storage: { local: { get: vi.fn(), set: vi.fn() } },
    });

    trackExtensionEvent("first_card_created");

    expect(sendMessage).toHaveBeenCalledWith({
      type: TRACK_EXTENSION_EVENT_MESSAGE,
      event: "first_card_created",
    });
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("sends the build version with the event so a stale package is visible (#159)", () => {
    trackExtensionEvent("first_srs_review");
    const [, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(JSON.parse(String(init.body))).toEqual({ event: "first_srs_review", v: "0.5.7" });
  });

  it("drops a name that is not on the allowlist before it reaches the relay", () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", { runtime: { id: "x", sendMessage }, storage: { local: { get: vi.fn(), set: vi.fn() } } });
    trackExtensionEvent("arbitrary_string" as never);
    expect(sendMessage).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
