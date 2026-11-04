import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  apply: vi.fn(),
  legacy: vi.fn(),
  kv: vi.fn(),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({ env: { LEARN_DB: {} } }),
}));
vi.mock("./learn-store", () => ({
  LearnStore: class {
    account = mocks.account;
    apply = mocks.apply;
  },
  LearnError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock("./sync-store", () => ({
  getLegacyCloudSyncEnvelope: mocks.legacy,
  resolveStore: async () => ({ get: mocks.kv }),
}));
import { getLearnStore, newImportOps, snapshotImportOps } from "./learn-server";
import { LearnError } from "./learn-store";
import { emptyLearnState, type LearnOp } from "./learn-protocol/model";
import { normalizeAnimeVocabExport } from "./sync";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.account.mockResolvedValue({ migrated: false });
  mocks.kv.mockResolvedValue(null);
  mocks.legacy.mockResolvedValue({
    snapshot: normalizeAnimeVocabExport({
      settings: { openaiKey: "private", subLens: false },
      vocab: { 猫: { state: "known", reading: "neko", gloss: "cat" } },
    }),
  });
});
describe("one-time legacy migration", () => {
  it("imports stable operations, excludes secrets, and marks completion last", async () => {
    await getLearnStore("a");
    const first = structuredClone(mocks.apply.mock.calls);
    expect(JSON.stringify(first)).not.toContain("private");
    expect(first[0][0][0]).toMatchObject({
      kind: "import_local",
      payload: { word: { base: "猫" } },
    });
    expect(first.at(-1)?.[1]).toEqual({ migrated: true });
    mocks.apply.mockClear();
    await getLearnStore("a");
    expect(mocks.apply.mock.calls).toEqual(first);
  });
  it("does not reread KV or reimport after migration", async () => {
    mocks.account.mockResolvedValue({ migrated: true });
    await getLearnStore("a");
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.apply).not.toHaveBeenCalled();
  });
  it("skips one bad legacy record instead of blocking the account", async () => {
    mocks.legacy.mockResolvedValue({
      snapshot: normalizeAnimeVocabExport({
        vocab: {
          猫: { state: "known", reading: "neko", gloss: "cat" },
          犬: { state: "known", reading: "inu", gloss: "dog" },
        },
      }),
    });
    mocks.kv.mockResolvedValue(
      JSON.stringify({
        schemaVersion: 1,
        notebooks: [
          {
            id: "nb",
            name: "prototype",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            entries: [],
          },
        ],
      }),
    );
    // The batch fails on 犬; each record is then applied on its own.
    mocks.apply.mockImplementation(async (ops: LearnOp[]) => {
      if (ops.some((op) => (op.payload.word as { base?: string })?.base === "犬"))
        throw new LearnError("word_not_found", 404);
      return { acknowledged: [] };
    });
    await getLearnStore("a");
    const applied = mocks.apply.mock.calls.map(([ops]) => ops as LearnOp[]);
    const singles = applied.filter((ops) => ops.length === 1).flat();
    expect(singles.some((op) => (op.payload.word as { base?: string })?.base === "猫")).toBe(true);
    expect(singles.some((op) => op.kind === "notebook")).toBe(true);
    expect(mocks.apply.mock.calls.at(-1)?.[1]).toEqual({ migrated: true });
  });
  it("rethrows transient failures so migration retries later", async () => {
    mocks.apply.mockRejectedValue(new LearnError("concurrent_write_retry", 409));
    await expect(getLearnStore("a")).rejects.toThrow("concurrent_write_retry");
  });
});
describe("legacy snapshot uploads", () => {
  it("only imports words, days and settings the cloud does not have", () => {
    const snapshot = normalizeAnimeVocabExport({
      settings: { subLens: false, autoSpeak: true },
      vocab: {
        猫: { state: "known", reading: "neko", gloss: "cat" },
        犬: { state: "known", reading: "inu", gloss: "dog" },
      },
    });
    const state = emptyLearnState();
    const ops = snapshotImportOps(snapshot, "p");
    expect(newImportOps(state, ops)).toEqual(ops.filter((op) => op.payload.word || op.payload.daily || Object.keys(op.payload.settings as object).length));
    state.words["猫"] = snapshot.words.find((w) => w.base === "猫")!;
    state.settings.subLens = true;
    const fresh = newImportOps(state, ops);
    expect(fresh.map((op) => (op.payload.word as { base?: string })?.base).filter(Boolean)).toEqual(["犬"]);
    expect(fresh.find((op) => op.payload.settings)?.payload.settings).toEqual({ autoSpeak: true });
    state.words["犬"] = snapshot.words.find((w) => w.base === "犬")!;
    state.settings.autoSpeak = false;
    expect(newImportOps(state, ops)).toEqual([]);
  });
});
