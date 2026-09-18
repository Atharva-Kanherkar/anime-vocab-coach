import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../src/lib/storage";
import { getOnboarding, stampOnboarding } from "../src/lib/onboarding-store";
import { EMPTY_ONBOARDING } from "../src/lib/onboarding";
import type { DictEntry, JudgmentMeta, Token, VocabMap } from "../src/types";

/**
 * The stamps are only worth anything if the real mining paths set them. These
 * drive storage.ts itself (not the pure module) against an in-memory
 * chrome.storage, so a future refactor that moves the call sites fails here.
 */

const local: Record<string, unknown> = {};

const token = (base: string): Token => ({
  surface: base,
  base,
  reading: "やくそく",
  pos: "名詞",
  pos1: "一般",
});

const OVERLAY: Record<string, DictEntry> = {
  約束: { reading: "やくそく", glosses: ["promise"], level: 4, freqRank: 500 },
  記憶: { reading: "きおく", glosses: ["memory"], level: 4, freqRank: 900 },
};

const META: JudgmentMeta = { reading: "やくそく", gloss: "promise", level: 4, freqRank: 500 };

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: { id: "lkjbomofgfonjjbemobacegffepbdnel", sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn(async (keys: string[]) =>
          Object.fromEntries(keys.map((k) => [k, local[k]]).filter(([, v]) => v !== undefined))
        ),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(local, value);
        }),
      },
    },
  });
});

describe("onboarding stamps on the real mining paths", () => {
  it("starts empty", async () => {
    expect(await getOnboarding()).toEqual(EMPTY_ONBOARDING);
  });

  it("stamps watchedAt when a subtitle line first produces a word", async () => {
    await storage.recordSeen([token("約束")], {} as VocabMap, new Set(), "en-ja", OVERLAY);
    const first = await getOnboarding();
    expect(first.watchedAt).toBeGreaterThan(0);
    expect(first.cardShownAt).toBe(0);
    expect(first.firstCardAt).toBe(0);

    // A second line an episode later must not move the stamp.
    await storage.recordSeen([token("記憶")], {} as VocabMap, new Set(), "en-ja", OVERLAY);
    expect((await getOnboarding()).watchedAt).toBe(first.watchedAt);
  });

  it("stamps cardShownAt when the panel puts a word on screen", async () => {
    await storage.recordCardShown("約束");
    expect((await getOnboarding()).cardShownAt).toBeGreaterThan(0);
  });

  it("stamps firstCardAt when a word is actually saved", async () => {
    await storage.judgeWord("約束", "learn", META);
    const state = await getOnboarding();
    expect(state.firstCardAt).toBeGreaterThan(0);

    await storage.judgeWord("記憶", "know", { ...META, reading: "きおく", gloss: "memory" });
    expect((await getOnboarding()).firstCardAt).toBe(state.firstCardAt);
  });

  it("does not count an ignore or a dismiss as mining", async () => {
    await storage.judgeWord("約束", "ignore", META);
    await storage.judgeWord("記憶", "dismiss", { ...META, reading: "きおく", gloss: "memory" });
    expect((await getOnboarding()).firstCardAt).toBe(0);
  });

  it("does not count an SRS review as a first card", async () => {
    // A review judgment needs a card that already exists, so it can never be
    // the moment the learner mined their first one.
    await storage.judgeWord("約束", "review-pass", META);
    expect((await getOnboarding()).firstCardAt).toBe(0);
  });
});

describe("a stamp losing a race with another extension context", () => {
  it("re-applies itself instead of vanishing", async () => {
    // chrome.storage.local has no compare-and-set. The install handler stamps
    // installedAt in the service worker while the welcome tab it just opened
    // stamps shownAt from its own read of the same key — the later write wins
    // and the other stamp is gone. Losing installedAt would mean the 24h
    // checklist never appears for that install, so it must heal.
    let clobbered = false;
    const foreign = { ...EMPTY_ONBOARDING, shownAt: 111 };

    vi.stubGlobal("chrome", {
      runtime: { id: "test" },
      storage: {
        local: {
          get: vi.fn(async (keys: string[]) =>
            Object.fromEntries(keys.map((k) => [k, local[k]]).filter(([, v]) => v !== undefined))
          ),
          set: vi.fn(async (value: Record<string, unknown>) => {
            Object.assign(local, value);
            if (!clobbered) {
              clobbered = true;
              local.onboarding = foreign; // the other context's write lands
            }
          }),
        },
      },
    });

    expect(await stampOnboarding("installedAt", 999)).toBe(true);
    const state = await getOnboarding();
    expect(state.installedAt).toBe(999);
    // The other context's stamp is kept too — the merge is not a rollback.
    expect(state.shownAt).toBe(111);
  });
});
