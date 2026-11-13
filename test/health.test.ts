import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEDUP_MS,
  HEALTH_EVENTS,
  HEALTH_SITES,
  MAX_OUTBOX,
  OUTBOX_KEY,
  admit,
  englishErrorText,
  flushHealth,
  normalizeHealthCode,
  receiveHealth,
  recordHealth,
  type HealthItem,
} from "../src/lib/health";
import {
  HEALTH_EVENTS as WEB_HEALTH_EVENTS,
  HEALTH_SITES as WEB_HEALTH_SITES,
  normalizeHealthCode as webNormalizeHealthCode,
} from "../web/src/lib/track-events";

/**
 * Extension health. The failure this exists for was silent at every layer: an
 * error string computed and dropped, a popup that never showed it, and no row
 * anywhere. Each test below is one of the ways the report itself could go
 * silent: a name the server drops, a code that floods the dataset, a row lost
 * when the network is the thing that failed.
 */

const local: Record<string, unknown> = {};
const network = vi.fn();
const posted = () =>
  network.mock.calls
    .filter(([url]) => String(url).endsWith("/api/track"))
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, string>);

beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  network.mockReset().mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", network);
  vi.stubGlobal("chrome", {
    runtime: { id: "ext", getManifest: () => ({ version: "0.7.3" }) },
    storage: {
      local: {
        get: async (keys: string | string[]) => {
          const out: Record<string, unknown> = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) if (k in local) out[k] = structuredClone(local[k]);
          return out;
        },
        set: async (values: Record<string, unknown>) => Object.assign(local, structuredClone(values)),
      },
    },
  });
});

const item = (over: Partial<HealthItem> = {}): HealthItem => ({
  name: "subs_english_failed",
  code: "network",
  site: "netflix",
  v: "0.7.3",
  at: 1_000,
  ...over,
});

describe("the lists the server allowlists", () => {
  it("are the same on both sides, so no report is dropped as unknown", () => {
    expect([...HEALTH_EVENTS]).toEqual([...WEB_HEALTH_EVENTS]);
    expect([...HEALTH_SITES]).toEqual([...WEB_HEALTH_SITES]);
  });

  it("every code the extension produces survives the server's own bound", () => {
    const raw = [
      "Extension context invalidated.",
      "Could not establish connection. Receiving end does not exist.",
      "Failed to fetch",
      "TimeoutError: signal timed out",
      "http_502",
      "subs_quota_exhausted",
      "course_502",
      "Sign in to your free account at animevocab.com/start.",
      "track_translated_network",
      "Something with SPACES and émoji 🎌 and a very long tail that goes on and on and on",
      "",
    ];
    for (const r of raw) {
      const code = normalizeHealthCode(r);
      expect(webNormalizeHealthCode(code)).toBe(code);
    }
  });
});

describe("normalizeHealthCode", () => {
  it("names the runtime failures a learner cannot see", () => {
    expect(normalizeHealthCode("Extension context invalidated.")).toBe("context_invalidated");
    expect(normalizeHealthCode(new Error("Could not establish connection. Receiving end does not exist."))).toBe("no_receiver");
    expect(normalizeHealthCode("Failed to fetch")).toBe("network");
    expect(normalizeHealthCode("The operation was aborted due to timeout")).toBe("timeout");
    expect(normalizeHealthCode("Sign in to your free account at animevocab.com/start.")).toBe("not_linked");
  });

  it("keeps server codes as they are and bounds anything else", () => {
    expect(normalizeHealthCode("http_403")).toBe("http_403");
    expect(normalizeHealthCode("subs_quota_exhausted")).toBe("subs_quota_exhausted");
    expect(normalizeHealthCode("Weird Thing!! happened")).toBe("weird_thing_happened");
    expect(normalizeHealthCode("x".repeat(200))).toHaveLength(48);
    expect(normalizeHealthCode("")).toBe("unknown");
    expect(normalizeHealthCode(undefined)).toBe("unknown");
  });
});

describe("admit: one row per name + code + site per window", () => {
  it("takes the first, drops a repeat inside the window, takes it again after", () => {
    const first = admit(item(), [], {}, 1_000);
    expect(first.admitted).toBe(true);
    const repeat = admit(item({ at: 2_000 }), [], first.sent, 2_000);
    expect(repeat.admitted).toBe(false);
    const later = admit(item({ at: 1_000 + DEDUP_MS + 1 }), [], first.sent, 1_000 + DEDUP_MS + 1);
    expect(later.admitted).toBe(true);
  });

  it("treats another reason or another site as news", () => {
    const first = admit(item(), [], {}, 1_000);
    expect(admit(item({ code: "http_502" }), first.outbox, first.sent, 1_001).admitted).toBe(true);
    expect(admit(item({ site: "youtube" }), first.outbox, first.sent, 1_001).admitted).toBe(true);
  });

  it("never grows the outbox past its cap, keeping the newest", () => {
    let outbox: HealthItem[] = [];
    let sent: Record<string, number> = {};
    for (let i = 0; i < MAX_OUTBOX + 5; i++) {
      const next = admit(item({ code: `code_${i}`, at: i }), outbox, sent, i);
      outbox = next.outbox;
      sent = next.sent;
    }
    expect(outbox).toHaveLength(MAX_OUTBOX);
    expect(outbox[outbox.length - 1].code).toBe(`code_${MAX_OUTBOX + 4}`);
  });
});

describe("delivery from the service worker", () => {
  it("posts a health row with the reason, site and build, then empties the outbox", async () => {
    local.syncToken = "avc_st_alice";
    await recordHealth("subs_english_failed", "Failed to fetch", "netflix");
    expect(posted()).toEqual([{ kind: "health", name: "subs_english_failed", code: "network", surface: "netflix", v: "0.7.3" }]);
    const auth = (network.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(auth.authorization).toBe("Bearer avc_st_alice");
    expect(local[OUTBOX_KEY]).toEqual([]);
  });

  it("keeps the row when the network is the failure, and sends it on the next flush", async () => {
    network.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await recordHealth("course_load_failed", "course_502", "worker");
    expect((local[OUTBOX_KEY] as HealthItem[]).map((o) => o.code)).toEqual(["course_502"]);
    expect(await flushHealth()).toBe(1);
    expect(local[OUTBOX_KEY]).toEqual([]);
    expect(posted().at(-1)).toMatchObject({ name: "course_load_failed", code: "course_502", surface: "worker" });
  });

  it("does not post the same failure twice in a window", async () => {
    await recordHealth("subs_english_failed", "http_502", "youtube");
    await recordHealth("subs_english_failed", "http_502", "youtube");
    expect(posted()).toHaveLength(1);
  });

  it("drops a name that is not on the list instead of sending free text", async () => {
    await recordHealth("not_a_health_event" as never, "x", "netflix");
    expect(await receiveHealth({ name: "made_up", code: "x", site: "netflix" })).toEqual({ ok: false });
    expect(posted()).toHaveLength(0);
  });

  it("accepts a relayed report from a content script and sends it", async () => {
    expect(await receiveHealth({ name: "bg_unreachable", code: "no_receiver", site: "crunchyroll", v: "0.7.2", at: 5 })).toEqual({ ok: true });
    await vi.waitFor(() => expect(posted()).toHaveLength(1));
    expect(posted()[0]).toMatchObject({ name: "bg_unreachable", code: "no_receiver", surface: "crunchyroll", v: "0.7.2" });
  });
});

describe("englishErrorText: the popup says why English is missing", () => {
  it("turns each kind of failure into something a learner can act on", () => {
    expect(englishErrorText(null)).toBe("");
    expect(englishErrorText("subs_quota_exhausted")).toMatch(/limit is used up/);
    expect(englishErrorText("not_linked")).toMatch(/Sign in/);
    expect(englishErrorText("bg_context_invalidated")).toMatch(/reload this tab/);
    expect(englishErrorText("network")).toMatch(/can't reach AnimeVocab/);
    expect(englishErrorText("http_502")).toBe("English unavailable (http_502)");
  });
});
