import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEATURE_EVENTS,
  SIGNIN_FEATURE_EVENTS,
  SIGNIN_SURFACES,
  TRACK_SIGNIN_MESSAGE,
  isSigninEvent,
  isSigninSurface,
  sendSigninBeacon,
  trackSignin,
} from "../src/lib/feature-events";
import {
  SIGNIN_FUNNEL_EVENTS as WEB_SIGNIN_EVENTS,
  SIGNIN_SURFACES as WEB_SIGNIN_SURFACES,
} from "../web/src/lib/signin-funnel";
import {
  EXTENSION_LEARNING_LOOP_EVENTS,
  LEARNING_LOOP_EVENTS,
  TRACKABLE_EVENTS,
} from "../web/src/lib/track-events";

const local: Record<string, unknown> = {};

const trackCalls = (): { url: string; init: RequestInit }[] =>
  (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    .filter(([url]) => url.includes("/api/track"))
    .map(([url, init]) => ({ url, init }));

const bodies = (): { kind?: string; name?: string; surface?: string }[] =>
  trackCalls().map(({ init }) => JSON.parse(String(init.body)));

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  vi.unstubAllGlobals();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: {
      id: "lkjbomofgfonjjbemobacegffepbdnel",
      sendMessage: vi.fn(async () => undefined),
      getManifest: () => ({ version: "0.7.2" }),
    },
    storage: {
      local: {
        get: vi.fn((keys: string[], cb?: (v: Record<string, unknown>) => void) => {
          const value = Object.fromEntries(
            keys.map((k) => [k, local[k]]).filter(([, v]) => v !== undefined)
          );
          if (cb) {
            cb(value);
            return undefined;
          }
          return Promise.resolve(value);
        }),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(local, value);
        }),
      },
    },
  });
});

describe("sign-in event allowlist", () => {
  it("mirrors the web's event list exactly", () => {
    expect([...SIGNIN_FEATURE_EVENTS]).toEqual([...WEB_SIGNIN_EVENTS]);
  });

  it("mirrors the web's surface list exactly", () => {
    expect([...SIGNIN_SURFACES]).toEqual([...WEB_SIGNIN_SURFACES]);
  });

  it("only sends names the server will accept", () => {
    for (const event of SIGNIN_FEATURE_EVENTS) {
      expect(TRACKABLE_EVENTS as readonly string[]).toContain(event);
      expect(FEATURE_EVENTS as readonly string[]).toContain(event);
    }
  });

  it("puts every event on the learning-loop panel's query list", () => {
    for (const event of SIGNIN_FEATURE_EVENTS) {
      expect(LEARNING_LOOP_EVENTS as readonly string[]).toContain(event);
      expect(EXTENSION_LEARNING_LOOP_EVENTS as readonly string[]).toContain(event);
    }
  });

  it("rejects names and surfaces outside the lists", () => {
    expect(isSigninEvent("signin_gate_shown")).toBe(true);
    expect(isSigninEvent("signin_bogus")).toBe(false);
    expect(isSigninSurface("popup")).toBe(true);
    expect(isSigninSurface("ext_popup")).toBe(false);
  });
});

describe("trackSignin", () => {
  it("sends the event and surface with the sync token", async () => {
    local.syncToken = "avc_st_abc123";
    await trackSignin("signin_gate_shown", "content_chip");
    const [call] = trackCalls();
    expect(call!.url).toBe("https://animevocab.com/api/track");
    expect((call!.init.headers as Record<string, string>).authorization).toBe(
      "Bearer avc_st_abc123"
    );
    expect(JSON.parse(String(call!.init.body))).toEqual({
      kind: "feature",
      name: "signin_gate_shown",
      surface: "content_chip",
      v: "0.7.2",
    });
  });

  it("relays through the worker outside the service worker", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", sendMessage },
      storage: { local: { get: vi.fn(), set: vi.fn() } },
    });

    await trackSignin("signin_started", "popup");

    expect(sendMessage).toHaveBeenCalledWith({
      type: TRACK_SIGNIN_MESSAGE,
      event: "signin_started",
      surface: "popup",
    });
    expect(trackCalls()).toHaveLength(0);
  });

  it("drops unknown events and surfaces", async () => {
    await trackSignin("signin_bogus" as never, "popup");
    await trackSignin("signin_started", "ext_popup" as never);
    expect(trackCalls()).toHaveLength(0);
  });

  it("never throws when the network is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(trackSignin("signin_completed", "start_page")).resolves.toBeUndefined();
  });
});

describe("sendSigninBeacon", () => {
  it("posts a feature row with the surface", async () => {
    await sendSigninBeacon("signin_gate_dismissed", "content_chip");
    expect(bodies()).toEqual([
      {
        kind: "feature",
        name: "signin_gate_dismissed",
        surface: "content_chip",
        v: "0.7.2",
      },
    ]);
  });

  it("drops a surface the server does not know", async () => {
    await sendSigninBeacon("signin_gate_shown", "ext_popup" as never);
    expect(trackCalls()).toHaveLength(0);
  });
});
