import { beforeEach, describe, expect, it, vi } from "vitest";
import * as storage from "../src/lib/storage";
import { mergeCloudSnapshots, normalizeAnimeVocabExport } from "../web/src/lib/sync";
import type { JudgmentMeta, Token, VocabRecord } from "../src/types";

// ISO 25010 usability (user error protection): a judgment can be taken back.
// Review of #172 findings 4 and 5: the undo reverses only its own judgment,
// refuses when another judgment got there first, keeps what happened since,
// and is written so the cloud merge keeps it.
const local: Record<string, unknown> = {};
const META: JudgmentMeta = { reading: "やくそく", gloss: "promise", level: 4, freqRank: 500 };
const T0 = Date.parse("2026-10-01T10:00:00Z");

beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        // Like chrome.storage, hand objects back with their keys sorted: an
        // order-sensitive comparison in the undo check slipped past a fake
        // that preserved insertion order.
        get: vi.fn((keys: string[], cb?: (r: Record<string, unknown>) => void) => {
          const sortKeys = (v: unknown): unknown =>
            Array.isArray(v) ? v.map(sortKeys)
              : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]))
              : v;
          const r = Object.fromEntries(keys.filter((k) => k in local).map((k) => [k, sortKeys(structuredClone(local[k]))]));
          if (cb) cb(r);
          return Promise.resolve(r);
        }),
        set: vi.fn(async (v: Record<string, unknown>) => void Object.assign(local, structuredClone(v))),
      },
    },
  });
});

const word = (base: string) => ((local.vocab || {}) as Record<string, VocabRecord>)[base];
const learning = (): VocabRecord => ({
  state: "learning", reading: "やくそく", gloss: "promise", level: 4, freqRank: 500, seenCount: 3, shownCount: 1,
  firstSeenAt: T0 - 864e5, lastSeenAt: T0, srs: { stage: 3, dueAt: T0 + 864e5, lapses: 1 },
});

describe("undoJudgment", () => {
  it("puts back the state and schedule the judgment replaced", async () => {
    local.vocab = { 約束: learning() };
    const { undo } = await storage.judgeWordUndoable("約束", "know", META);
    expect(word("約束").state).toBe("known");

    expect(await storage.undoJudgment(undo)).toEqual({ undone: true });
    expect(word("約束").state).toBe("learning");
    expect(word("約束").srs).toEqual(learning().srs);
  });

  it("refuses when another tab judged the word since, keeping that newer judgment (finding 4)", async () => {
    local.vocab = { 約束: learning() };
    const tabA = await storage.judgeWordUndoable("約束", "know", META);
    await storage.judgeWord("約束", "ignore", META); // tab B, later
    expect(await storage.undoJudgment(tabA.undo)).toEqual({ undone: false, reason: "changed" });
    expect(word("約束").state).toBe("ignored");
  });

  it("keeps sightings recorded after the judgment", async () => {
    local.vocab = { 約束: learning() };
    const { undo } = await storage.judgeWordUndoable("約束", "know", META);
    const token: Token = { surface: "約束", base: "約束", reading: "ヤクソク", pos: "名詞", pos1: "一般" };
    const seenBefore = word("約束").seenCount;
    await storage.recordSeen([token], local.vocab as Record<string, VocabRecord>, new Set(), "en-ja", {
      約束: { reading: "やくそく", glosses: ["promise"], level: 4, freqRank: 500 },
    });
    const seenAfter = word("約束").seenCount;
    await storage.undoJudgment(undo);
    expect(word("約束").seenCount).toBe(seenAfter);
    expect(seenAfter).toBeGreaterThanOrEqual(seenBefore);
  });

  it("undoes a Learn, whose schedule comes back from storage with its keys reordered", async () => {
    local.vocab = { 約束: { ...learning(), state: "new", srs: null } };
    const { undo } = await storage.judgeWordUndoable("約束", "learn", META);
    expect(await storage.undoJudgment(undo)).toEqual({ undone: true });
    expect(word("約束")).toMatchObject({ state: "new", srs: null });
  });

  it("returns a word the judgment created to 'new' instead of deleting it", async () => {
    const { undo } = await storage.judgeWordUndoable("約束", "learn", META);
    await storage.undoJudgment(undo);
    expect(word("約束")).toMatchObject({ state: "new", srs: null });
  });
});

describe("an undo survives cloud sync (finding 5)", () => {
  /** What the extension pushes, through the web's real import and merge. */
  async function push(server: ReturnType<typeof normalizeAnimeVocabExport> | null) {
    const incoming = normalizeAnimeVocabExport(await storage.exportAll());
    return server ? mergeCloudSnapshots(server, incoming) : incoming;
  }
  const cloudState = (snap: ReturnType<typeof normalizeAnimeVocabExport>) => snap.words.find((w) => w.base === "約束")?.state;

  it("the cloud ends up with the undone state, not the synced judgment", async () => {
    local.vocab = { 約束: learning() };
    let cloud = await push(null);
    const { undo } = await storage.judgeWordUndoable("約束", "know", META);
    // Make the judged copy look seen later, as the line that raised the card does.
    (local.vocab as Record<string, VocabRecord>)["約束"].lastSeenAt = Date.now();
    cloud = await push(cloud);
    expect(cloudState(cloud)).toBe("known");

    await storage.undoJudgment(undo);
    cloud = await push(cloud);
    expect(word("約束").state).toBe("learning");
    expect(cloudState(cloud)).toBe("learning");
  });

  it("local and cloud agree on the day's counts after an undo", async () => {
    local.vocab = { 約束: learning() };
    let cloud = await push(null);
    const { undo } = await storage.judgeWordUndoable("約束", "know", META);
    cloud = await push(cloud);
    await storage.undoJudgment(undo);
    cloud = await push(cloud);
    const day = storage.todayKey();
    const localJudged = (local.stats as { daily: Record<string, { judged: number }> }).daily[day]!.judged;
    expect(cloud.daily.find((d) => d.day === day)?.judged).toBe(localJudged);
  });
});
