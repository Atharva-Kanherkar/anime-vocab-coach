import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFile } from "node:fs/promises";
import { LearnStore, type LearnDB } from "../../web/src/lib/learn-store";
import {
  newLearnOp,
  emptyLearnState,
  projectLearnOp,
  applyLearnDelta,
} from "../../web/src/lib/learn-protocol/model";
import { validateLearnOps } from "../../web/src/lib/learn-protocol/validate";
import type { CloudWordRecord } from "../../web/src/lib/sync";
let mf: Miniflare;
let db: LearnDB;
const word: CloudWordRecord = {
  base: "猫",
  reading: "neko",
  gloss: "cat",
  state: "learning",
  level: 5,
  freqRank: 5,
  seenCount: 1,
  shownCount: 0,
  firstSeenAt: "2026-01-01T00:00:00.000Z",
  lastSeenAt: "2026-01-01T00:00:00.000Z",
  review: { stage: 1, lapses: 0, dueAt: "2026-01-01T00:00:00.000Z" },
  source: null,
};
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    compatibilityDate: "2026-06-01",
    d1Databases: ["DB"],
  });
  db = (await mf.getD1Database("DB")) as unknown as LearnDB;
  const sql = (
    await Promise.all(
      ["0005_learner_store.sql", "0006_learner_epoch.sql"].map((f) =>
        readFile(new URL(`../migrations/${f}`, import.meta.url), "utf8"),
      ),
    )
  ).join(";\n");
  await db.batch(
    sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => db.prepare(s)),
  );
});
afterAll(async () => {
  await mf?.dispose();
});
const importWord = () => newLearnOp("import_local", { word });
describe("D1 learner operation transactions", () => {
  it("accepts the maximum batch without exceeding D1's bound-parameter limit", async () => {
    const store = new LearnStore(db, "max-batch");
    const ops = Array.from({ length: 100 }, () =>
      newLearnOp("progress", { day: "2026-11-01", delta: { watchMin: 1 } }),
    );
    await store.apply(ops);
    await store.apply(ops);
    expect((await store.read()).state.daily["2026-11-01"].watchMin).toBe(100);
  });

  it("keeps same-card reviews from concurrent devices exactly once and paginates", async () => {
    const store = new LearnStore(db, "interleaved");
    await store.apply([importWord()]);
    const phone = newLearnOp("review", {
      base: "猫",
      result: "pass",
      day: "2026-11-01",
    });
    const extension = newLearnOp("review", {
      base: "猫",
      result: "fail",
      day: "2026-11-01",
    });
    await Promise.all([store.apply([phone]), store.apply([extension])]);
    await store.apply([phone, extension]);
    const state = (await store.read()).state;
    expect(state.daily["2026-11-01"]).toMatchObject({ judged: 2, reviews: 2 });
    expect((await store.export()).reviews).toHaveLength(2);
    const first = await store.changes(0, 2);
    expect(first.changes).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const second = await store.changes(first.cursor, 2);
    expect(second.changes).toHaveLength(1);
    expect(second.hasMore).toBe(false);
    expect((await store.changes(second.cursor)).changes).toHaveLength(0);
    expect((await new LearnStore(db, "other").changes(0)).changes).toHaveLength(
      0,
    );
    const before = structuredClone(state.words["猫"]);
    await store.apply([importWord()]);
    expect((await store.read()).state.words["猫"]).toEqual(before);
    await expect(
      store.apply([
        { ...phone, payload: { ...phone.payload, result: "fail" } },
      ]),
    ).rejects.toThrow("operation_id_reused");
  });
  it("has no partial writes after a semantic failure", async () => {
    const store = new LearnStore(db, "atomic");
    await expect(
      store.apply([
        newLearnOp("settings", { settings: { subLens: false } }),
        newLearnOp("review", {
          base: "missing",
          result: "pass",
          day: "2026-11-01",
        }),
      ]),
    ).rejects.toThrow("word_not_found");
    expect((await store.read()).state.settings).toEqual({});
    expect((await store.changes(0)).changes).toHaveLength(0);
  });
  it("preserves cloud settings during imports and exports/deletes every table", async () => {
    const store = new LearnStore(db, "lifecycle");
    const nb = {
      id: "notebook",
      name: "Anime",
      entries: [],
      createdAt: word.firstSeenAt,
      updatedAt: word.firstSeenAt,
    };
    const entry = {
      id: "entry",
      kind: "note",
      note: "hello",
      word: null,
      reading: null,
      gloss: null,
      line: null,
      title: null,
      tags: [],
      level: null,
      createdAt: word.firstSeenAt,
    };
    await store.apply([
      importWord(),
      newLearnOp("settings", { settings: { subLens: false } }),
      newLearnOp("import_local", {
        settings: { subLens: true, subLensPeek: false },
      }),
      newLearnOp("notebook", { notebook: nb }),
      newLearnOp("notebook_item", { id: nb.id, entry }),
      newLearnOp("review", { base: "猫", result: "pass", day: "2026-11-01" }),
    ]);
    expect((await store.read()).state.settings).toEqual({
      subLens: false,
      subLensPeek: false,
    });
    await store.apply([
      newLearnOp("notebook", { notebook: { ...nb, name: "Renamed" } }),
    ]);
    expect((await store.read()).state.notebooks.notebook.entries).toHaveLength(
      1,
    );
    const exported = await store.export();
    expect(exported.words["猫"]).toBeTruthy();
    expect(exported.reviews).toHaveLength(1);
    expect(exported.operations).toHaveLength(7);
    await store.delete();
    await expect(store.read()).rejects.toThrow("account_deleted");
    await expect(store.apply([importWord()])).rejects.toThrow(
      "account_deleted",
    );
    for (const table of [
      "learn_words",
      "learn_daily",
      "learn_settings",
      "learn_notebooks",
      "learn_notebook_items",
      "learn_ops",
      "learn_review_log",
    ]) {
      expect(
        await db
          .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`)
          .bind("lifecycle")
          .first(),
      ).toEqual({ n: 0 });
    }
  });
  it("logs one notebook entry per item operation, not the whole notebook", async () => {
    const store = new LearnStore(db, "entry-deltas");
    const nb = {
      id: "nb",
      name: "prototype",
      entries: [],
      createdAt: word.firstSeenAt,
      updatedAt: word.firstSeenAt,
    };
    const entry = (id: string, createdAt: string) => ({
      id,
      kind: "note",
      note: id,
      word: null,
      reading: null,
      gloss: null,
      line: null,
      title: null,
      tags: ["prototype"],
      level: null,
      createdAt,
    });
    await store.apply([newLearnOp("notebook", { notebook: nb })]);
    for (let i = 0; i < 5; i++)
      await store.apply([
        newLearnOp("notebook_item", {
          id: "nb",
          entry: entry(`e${i}`, `2026-01-0${i + 1}T00:00:00.000Z`),
        }),
      ]);
    await store.apply([
      newLearnOp("notebook_item_delete", { id: "nb", entryId: "e1" }),
    ]);
    const { changes } = await store.changes(0);
    for (const change of changes) {
      expect(change.delta.notebooks?.nb?.entries ?? []).toEqual([]);
      expect((change.delta.entries ?? []).length).toBeLessThanOrEqual(1);
    }
    // Replaying the log gives the stored notebook, newest entry first.
    const replay = emptyLearnState();
    for (const change of changes) applyLearnDelta(replay, change.delta);
    const stored = (await store.read()).state.notebooks.nb;
    expect(replay.notebooks.nb).toEqual(stored);
    expect(stored.entries.map((e) => e.id)).toEqual(["e4", "e3", "e2", "e0"]);
    expect(await store.readNotebooks()).toEqual({ nb: stored });
  });
  it("deletes individual items and notebooks", async () => {
    const store = new LearnStore(db, "notebooks");
    const nb = {
      id: "nb",
      name: "Show",
      entries: [],
      createdAt: word.firstSeenAt,
      updatedAt: word.firstSeenAt,
    };
    await store.apply([
      newLearnOp("notebook", { notebook: nb }),
      newLearnOp("notebook_item", {
        id: "nb",
        entry: {
          id: "e",
          kind: "note",
          note: "n",
          word: null,
          reading: null,
          gloss: null,
          line: null,
          title: null,
          tags: [],
          level: null,
          createdAt: word.firstSeenAt,
        },
      }),
    ]);
    await store.apply([
      newLearnOp("notebook_item_delete", { id: "nb", entryId: "e" }),
    ]);
    expect((await store.read()).state.notebooks.nb.entries).toHaveLength(0);
    await store.apply([newLearnOp("notebook_delete", { id: "nb" })]);
    expect((await store.read()).state.notebooks).toEqual({});
  });
});
it("migrates review history without changing an already-applied schedule", async () => {
  const store = new LearnStore(db, "history");
  await store.apply([
    importWord(),
    newLearnOp("review_history", {
      base: "猫",
      result: "pass",
      day: "2026-11-01",
    }),
  ]);
  expect((await store.export()).reviews).toHaveLength(1);
  expect((await store.read()).state.words["猫"].review?.stage).toBe(1);
});
it("does not resurrect data when account deletion races a write", async () => {
  const store = new LearnStore(db, "delete-race");
  await store.apply([importWord()]);
  await Promise.allSettled([
    store.apply([
      newLearnOp("review", { base: "猫", result: "pass", day: "2026-11-01" }),
    ]),
    store.delete(),
  ]);
  await expect(store.read()).rejects.toThrow("account_deleted");
  expect(
    await db
      .prepare("SELECT COUNT(*) AS n FROM learn_words WHERE user_id=?")
      .bind("delete-race")
      .first(),
  ).toEqual({ n: 0 });
});
it("resets self-serve deletions into a new, usable epoch", async () => {
  const store = new LearnStore(db, "reset");
  await store.apply([importWord()]);
  const before = await store.account();
  await store.reset();
  const after = await store.account();
  expect(after.epoch).toBe(before.epoch + 1);
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.migrated).toBe(true);
  expect((await store.read()).state.words).toEqual({});
  expect(await store.changes(0)).toMatchObject({ changes: [], epoch: after.epoch });
  // A device still on the old epoch cannot write into the new one.
  await expect(
    store.apply([importWord()], { epoch: before.epoch }),
  ).rejects.toThrow("epoch_changed");
  expect((await store.read()).state.words).toEqual({});
  const result = await store.apply([importWord()], { epoch: after.epoch });
  expect(result).toMatchObject({ changed: true, epoch: after.epoch });
  expect((await store.read()).state.words["猫"]).toBeTruthy();
});
it("returns before/after state and the new revision without a reread", async () => {
  const store = new LearnStore(db, "snapshots");
  const op = importWord();
  const first = await store.apply([op], { snapshots: true });
  expect(first.before?.words).toEqual({});
  expect(first.after?.words["猫"]).toBeTruthy();
  expect(first.revision).toBe((await store.account()).revision);
  const again = await store.apply([op], { snapshots: true });
  expect(again).toMatchObject({ changed: false, revision: first.revision });
});
it("checks the tombstone with one account row and supports an identity probe", async () => {
  const store = new LearnStore(db, "probe");
  await store.apply([importWord()]);
  const probe = await store.changes(0, 0);
  expect(probe).toMatchObject({ changes: [], hasMore: true, cursor: 0 });
});
describe("operation boundary", () => {
  it.each([
    null,
    [],
    Array(101).fill(newLearnOp("settings", { settings: {} })),
    [newLearnOp("unknown" as never, {})],
    [newLearnOp("settings", { settings: { openaiKey: "secret" } })],
    [newLearnOp("settings", { settings: { subLens: "no" } })],
    [newLearnOp("review", { base: "猫", result: "oops", day: "2026-01-01" })],
    [{ ...importWord(), user_id: "someone" }],
    [{ ...importWord(), client_ts: "no" }],
    [newLearnOp("progress", { day: "2026-11-01", delta: { reviews: -1 } })],
  ])("rejects invalid batches %#", (raw) => {
    expect(() => validateLearnOps(raw)).toThrow();
  });
  it("replays pending intent over remote review state", () => {
    const state = emptyLearnState();
    projectLearnOp(state, importWord());
    projectLearnOp(
      state,
      newLearnOp("review", { base: "猫", result: "pass", day: "2026-11-01" }),
    );
    projectLearnOp(
      state,
      newLearnOp("word", {
        word: { ...word, seenCount: 2 },
        intent: "seen",
        seenDelta: 1,
      }),
    );
    expect(state.words["猫"].review?.stage).toBe(2);
    expect(state.words["猫"].seenCount).toBe(2);
  });
});
