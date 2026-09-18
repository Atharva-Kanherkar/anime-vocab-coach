import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXTENSION_EVENTS,
  EXTENSION_MILESTONE_STORAGE_KEY,
  trackExtensionMilestone,
} from "../src/lib/extension-events";
import { EXTENSION_EVENTS as SERVER_EXTENSION_EVENTS } from "../web/src/lib/extension-funnel";

describe("extension funnel events", () => {
  const state: Record<string, unknown> = {};

  beforeEach(() => {
    for (const key of Object.keys(state)) delete state[key];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel" },
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

  it("sends lifecycle milestones only once per install", async () => {
    expect(await trackExtensionMilestone("first_card_created")).toBe(true);
    expect(await trackExtensionMilestone("first_card_created")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(state[EXTENSION_MILESTONE_STORAGE_KEY]).toEqual({ first_card_created: true });
  });
});
