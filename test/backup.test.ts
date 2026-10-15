import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeBackup, parseBackup, type Backup } from "../src/lib/backup";
import * as storage from "../src/lib/storage";
import type { VocabRecord } from "../src/types";

const rec = (over: Partial<VocabRecord> = {}): VocabRecord => ({
  state: "learning", reading: "やくそく", gloss: "promise", level: 4, freqRank: 500,
  seenCount: 3, shownCount: 1, firstSeenAt: 1000, lastSeenAt: 5000,
  srs: { stage: 2, dueAt: 9000, lapses: 0 }, ...over,
});
const empty: Backup = { vocab: {}, stats: { daily: {}, cardTimestamps: [] } };

describe("parseBackup", () => {
  it("rejects a file that is not a backup", () => {
    expect(parseBackup(null).ok).toBe(false);
    expect(parseBackup({ hello: 1 }).ok).toBe(false);
  });

  it("keeps good words and counts the malformed ones instead of failing", () => {
    const out = parseBackup({
      vocab: { 約束: rec(), bad1: { state: "weird" }, bad2: rec({ srs: { stage: 9, dueAt: 1, lapses: 0 } }) },
      stats: { daily: { "2026-10-01": { met: 2, judged: 1, reviews: 0, watchMin: 5 }, "not-a-day": {} }, cardTimestamps: [1, "x", 2] },
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(Object.keys(out.backup.vocab)).toEqual(["約束"]);
    expect(out.skipped).toBe(2);
    expect(Object.keys(out.backup.stats.daily)).toEqual(["2026-10-01"]);
    expect(out.backup.stats.cardTimestamps).toEqual([1, 2]);
  });
});

describe("mergeBackup", () => {
  it("adds missing words and never deletes one", () => {
    const { merged, added } = mergeBackup({ ...empty, vocab: { 猫: rec() } }, { ...empty, vocab: { 犬: rec() } });
    expect(Object.keys(merged.vocab).sort()).toEqual(["犬", "猫"]);
    expect(added).toBe(1);
  });

  it("keeps the more recently seen copy, but never rolls counts or first-seen back", () => {
    const mine = rec({ state: "learning", lastSeenAt: 5000, seenCount: 9, firstSeenAt: 2000 });
    const theirs = rec({ state: "known", srs: null, lastSeenAt: 8000, seenCount: 4, firstSeenAt: 1000 });
    const { merged, updated } = mergeBackup({ ...empty, vocab: { 約束: mine } }, { ...empty, vocab: { 約束: theirs } });
    expect(merged.vocab["約束"]).toMatchObject({ state: "known", seenCount: 9, firstSeenAt: 1000, lastSeenAt: 8000 });
    expect(updated).toBe(1);
  });

  it("takes the larger value of each day's counters (no double counting)", () => {
    const a: Backup = { vocab: {}, stats: { daily: { d: { met: 5, judged: 1, reviews: 0, watchMin: 10 } }, cardTimestamps: [1, 2] } };
    const b: Backup = { vocab: {}, stats: { daily: { d: { met: 3, judged: 4, reviews: 2, watchMin: 1 } }, cardTimestamps: [2, 3] } };
    const { merged } = mergeBackup(a, b);
    expect(merged.stats.daily.d).toEqual({ met: 5, judged: 4, reviews: 2, watchMin: 10 });
    expect(merged.stats.cardTimestamps).toEqual([1, 2, 3]);
  });
});

describe("export -> import round trip", () => {
  const local: Record<string, unknown> = {};
  beforeEach(() => {
    for (const k of Object.keys(local)) delete local[k];
    vi.stubGlobal("chrome", {
      runtime: { id: "t", sendMessage: vi.fn(async () => undefined) },
      storage: { local: {
        // exportAll uses the callback form; the writers use the promise form.
        get: vi.fn((keys: string[], cb?: (r: Record<string, unknown>) => void) => {
          const r = Object.fromEntries(keys.filter((k) => k in local).map((k) => [k, structuredClone(local[k])]));
          if (cb) cb(r);
          return Promise.resolve(r);
        }),
        set: vi.fn(async (v: Record<string, unknown>) => void Object.assign(local, structuredClone(v))),
      } },
    });
  });

  it("leaves the OpenAI key out of the backup file", async () => {
    local.settings = { openaiKey: "sk-secret-key" };
    const data = await storage.exportForBackup();
    expect(JSON.stringify(data)).not.toContain("sk-secret-key");
  });

  it("restores a reset browser to exactly what was exported", async () => {
    local.vocab = { 約束: rec(), 猫: rec({ state: "known", srs: null }) };
    local.stats = { daily: { "2026-10-01": { met: 2, judged: 1, reviews: 0, watchMin: 5 } }, cardTimestamps: [7] };
    const file = JSON.parse(JSON.stringify(await storage.exportForBackup()));
    const saved = structuredClone({ vocab: local.vocab, stats: local.stats });
    await storage.resetProgress();
    expect(local.vocab).toEqual({});

    const parsed = parseBackup(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(await storage.importBackup(parsed.backup)).toEqual({ added: 2, updated: 0 });
    expect({ vocab: local.vocab, stats: local.stats }).toEqual(saved);
  });
});
