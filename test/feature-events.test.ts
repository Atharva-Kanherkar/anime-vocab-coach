import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEATURE_EVENTS,
  PRO_FUNNEL_EVENTS,
  PRO_SURFACES,
  TRACK_FEATURE_MESSAGE,
  TRACK_PRO_MESSAGE,
  sendProBeacon,
  trackFeature,
  trackPro,
} from "../src/lib/feature-events";
import {
  PRO_FUNNEL_EVENTS as WEB_PRO_EVENTS,
  PRO_SURFACES as WEB_PRO_SURFACES,
} from "../web/src/lib/pro-funnel";
import {
  EXTENSION_LEARNING_LOOP_EVENTS,
  LEARNING_LOOP_EVENTS,
  TRACKABLE_EVENTS,
} from "../web/src/lib/track-events";
import * as storage from "../src/lib/storage";
import type { DictEntry, JudgmentMeta, Token } from "../src/types";

/**
 * Learning-loop telemetry (#111).
 *
 * Two failure modes are worth a test and neither shows up as an error at
 * runtime: a name the server's allowlist silently drops, and a beacon that
 * stops being fired from the mining path it was supposed to observe. Both
 * produce a dashboard reading zero, which is indistinguishable from a product
 * nobody uses — the exact confusion this issue existed to end.
 */

const local: Record<string, unknown> = {};

const trackCalls = (): { url: string; init: RequestInit }[] =>
  (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    .filter(([url]) => url.includes("/api/track"))
    .map(([url, init]) => ({ url, init }));

const bodies = (): { kind?: string; name?: string }[] =>
  trackCalls().map(({ init }) => JSON.parse(String(init.body)));

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: {
      id: "lkjbomofgfonjjbemobacegffepbdnel",
      sendMessage: vi.fn(async () => undefined),
      getManifest: () => ({ version: "0.5.7" }),
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

describe("feature event allowlist", () => {
  it("only sends names the server will accept", () => {
    for (const event of FEATURE_EVENTS) {
      expect(TRACKABLE_EVENTS as readonly string[]).toContain(event);
    }
  });

  /**
   * Tighter than the allowlist: /owner's learning-loop panel queries
   * LEARNING_LOOP_EVENTS by name, so a name that is merely trackable but not
   * on that list would be written and then never shown.
   */
  it("only sends names the learning-loop panel queries", () => {
    for (const event of FEATURE_EVENTS) {
      expect(LEARNING_LOOP_EVENTS as readonly string[]).toContain(event);
    }
  });

  it("matches the server's list of extension-fired events, so /owner's builds panel sees them all", () => {
    expect([...FEATURE_EVENTS].sort()).toEqual([...EXTENSION_LEARNING_LOOP_EVENTS].sort());
  });

  it("covers every learning-loop moment the extension owns", () => {
    expect([...FEATURE_EVENTS].sort()).toEqual(
      [
        "card_known",
        "card_learn",
        "card_shown",
        "extension_linked",
        "install_first_run",
        "listening_started",
        "review_done",
        "word_saved",
      ].sort()
    );
  });
});

describe("trackFeature", () => {
  it("attaches the sync token so the row can carry a userId", async () => {
    local.syncToken = "avc_st_abc123";
    await trackFeature("card_shown");
    const [call] = trackCalls();
    expect(call!.url).toBe("https://animevocab.com/api/track");
    expect((call!.init.headers as Record<string, string>).authorization).toBe(
      "Bearer avc_st_abc123"
    );
    expect(JSON.parse(String(call!.init.body))).toEqual({
      kind: "feature",
      name: "card_shown",
      v: "0.5.7",
    });
  });

  /**
   * #159: the Web Store served a package that predated every one of these
   * events, and the dashboard could not tell that apart from nobody using the
   * product. The version on each row is what makes a stale build visible.
   */
  it("stamps the build version, and still sends when the runtime has none", async () => {
    await trackFeature("word_saved");
    expect(bodies()[0]).toMatchObject({ name: "word_saved", v: "0.5.7" });

    (chrome.runtime as unknown as { getManifest: () => never }).getManifest = () => {
      throw new Error("context invalidated");
    };
    await trackFeature("review_done");
    expect(bodies()[1]).toMatchObject({ name: "review_done", v: "" });
  });

  it("still reports for an unlinked install, unauthenticated", async () => {
    await trackFeature("card_shown");
    const [call] = trackCalls();
    expect(call).toBeDefined();
    expect((call!.init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("drops a name that is not on the allowlist", async () => {
    await trackFeature("not_a_real_event" as never);
    expect(trackCalls()).toHaveLength(0);
  });

  it("never throws when the network is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(trackFeature("card_shown")).resolves.toBeUndefined();
  });

  /**
   * A content script runs at youtube.com's origin, so its POST to
   * animevocab.com is cross-origin and CORS blocks it — silently, which is the
   * worst kind of blocked. Outside the service worker the beacon must be
   * relayed, never sent in place.
   */
  it("relays through the service worker when it is not the service worker", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", sendMessage },
      storage: { local: { get: vi.fn(), set: vi.fn() } },
    });

    await trackFeature("review_done");

    expect(sendMessage).toHaveBeenCalledWith({
      type: TRACK_FEATURE_MESSAGE,
      event: "review_done",
    });
    expect(trackCalls()).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

// --- the real mining paths, driven through storage.ts itself ---------------

const token = (base: string): Token => ({
  surface: base,
  base,
  reading: "やくそく",
  pos: "名詞",
  pos1: "一般",
});

const OVERLAY: Record<string, DictEntry> = {
  約束: { reading: "やくそく", glosses: ["promise"], level: 4, freqRank: 500 },
};

const META: JudgmentMeta = { reading: "やくそく", gloss: "promise", level: 4, freqRank: 500 };

describe("the learning loop as storage.ts actually runs it", () => {
  it("reports a card the panel put on screen", async () => {
    await storage.recordCardShown("約束");
    expect(bodies().map((b) => b.name)).toContain("card_shown");
  });

  it("separates a known word from one taken into the deck", async () => {
    await storage.recordSeen([token("約束")], OVERLAY);
    await storage.judgeWord("約束", "know", META);
    expect(bodies().map((b) => b.name)).toEqual(
      expect.arrayContaining(["card_known", "word_saved"])
    );
  });

  it("counts word_saved once, not on every later judgment of the same card", async () => {
    await storage.recordSeen([token("約束")], OVERLAY);
    await storage.judgeWord("約束", "learn", META);
    await storage.judgeWord("約束", "know", META);
    expect(bodies().filter((b) => b.name === "word_saved")).toHaveLength(1);
    expect(bodies().filter((b) => b.name === "card_learn")).toHaveLength(1);
    expect(bodies().filter((b) => b.name === "card_known")).toHaveLength(1);
  });

  it("reports a review as a review, not as another card saved", async () => {
    await storage.recordSeen([token("約束")], OVERLAY);
    await storage.judgeWord("約束", "learn", META);
    await storage.judgeWord("約束", "review-pass", META);
    const names = bodies().map((b) => b.name);
    expect(names).toContain("review_done");
    expect(names.filter((n) => n === "word_saved")).toHaveLength(1);
  });

  it("stays silent when the learner dismisses or ignores", async () => {
    await storage.recordSeen([token("約束")], OVERLAY);
    const before = bodies().length;
    await storage.judgeWord("約束", "ignore", META);
    await storage.judgeWord("約束", "dismiss", META);
    expect(bodies().slice(before).map((b) => b.name)).not.toContain("word_saved");
  });
});

/**
 * #162: the Pro funnel only reads per surface, and a surface the server does
 * not know is written as "", counted but never attributed. Nothing errors.
 */
describe("Pro funnel beacon", () => {
  it("mirrors the web's event list", () => {
    expect([...PRO_FUNNEL_EVENTS]).toEqual([...WEB_PRO_EVENTS]);
    for (const e of PRO_FUNNEL_EVENTS) expect(TRACKABLE_EVENTS as readonly string[]).toContain(e);
  });

  it("mirrors exactly the ext_ half of the web's surfaces", () => {
    expect([...PRO_SURFACES].sort()).toEqual(WEB_PRO_SURFACES.filter((s) => s.startsWith("ext_")).sort());
  });

  it("sends the surface with the token and build", async () => {
    local.syncToken = "avc_st_abc123";
    await sendProBeacon("pro_prompt_shown", "ext_milestone");
    const [call] = trackCalls();
    expect((call!.init.headers as Record<string, string>).authorization).toBe("Bearer avc_st_abc123");
    expect(JSON.parse(String(call!.init.body))).toEqual({
      kind: "feature",
      name: "pro_prompt_shown",
      surface: "ext_milestone",
      v: "0.5.7",
    });
  });

  it("never puts a surface on a learning-loop row", async () => {
    await trackFeature("word_saved");
    expect(JSON.parse(String(trackCalls()[0]!.init.body))).not.toHaveProperty("surface");
  });

  it("drops an unknown event or surface before the network", async () => {
    await sendProBeacon("pro_prompt_shown", "app_header" as never);
    await sendProBeacon("upgrade_prompt_shown" as never, "ext_popup");
    expect(trackCalls()).toHaveLength(0);
  });

  it("relays through the service worker from a page or content script", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", {});
    vi.stubGlobal("chrome", {
      runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", sendMessage },
      storage: { local: { get: vi.fn(), set: vi.fn() } },
    });

    await trackPro("pro_prompt_clicked", "ext_limit_sheet");

    expect(sendMessage).toHaveBeenCalledWith({
      type: TRACK_PRO_MESSAGE,
      event: "pro_prompt_clicked",
      surface: "ext_limit_sheet",
    });
    expect(trackCalls()).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});
