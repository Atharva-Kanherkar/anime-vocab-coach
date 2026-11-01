import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncWithCloud, syncPendingSignouts } from "../src/lib/cloud-sync";
import {
  clearSignedOutCache,
  setSyncToken,
  setSettings,
  judgeWord,
} from "../src/lib/storage";
import {
  emptyLearnState,
  newLearnOp,
  projectLearnOp,
  type LearnState,
  type LearnChange,
  type LearnOp,
} from "../web/src/lib/learn-protocol/model";
import type { PendingLearnOp } from "../src/lib/learn-cache";
const local: Record<string, any> = {};
const states = new Map<string, LearnState>();
const logs = new Map<string, LearnChange[]>();
const posted: { token: string; ops: LearnOp[] }[] = [];
const owner = (token: string) =>
  token.startsWith("other") ? "user-b" : "user-a";
const meta = { reading: "neko", gloss: "cat", level: 5, freqRank: 5 };
let offline = false;
let status = 200;
const epochs = new Map<string, number>();
/** Ops the fake server refuses for good, as the real one does for a missing word. */
const refused = new Set<string>();
const urls: string[] = [];
let onPost: (() => Promise<void>) | undefined;
function serverOp(token: string, op: LearnOp) {
  const user = owner(token);
  const state = states.get(user) || emptyLearnState();
  const log = logs.get(user) || [];
  if (!log.some((c) => c.op_id === op.op_id))
    log.push({
      cursor: log.length + 1,
      op_id: op.op_id,
      delta: projectLearnOp(state, op),
    });
  states.set(user, state);
  logs.set(user, log);
}
beforeEach(() => {
  for (const k of Object.keys(local)) delete local[k];
  states.clear();
  logs.clear();
  posted.length = 0;
  epochs.clear();
  refused.clear();
  urls.length = 0;
  offline = false;
  status = 200;
  onPost = undefined;
  local.syncToken = "token-a";
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(async () => ({ value: undefined })),
    },
    tabs: { query: vi.fn(async () => []) },
    storage: {
      local: {
        get: vi.fn((keys: string[] | string, cb?: Function) => {
          const values = Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys]).map((k) => [
              k,
              structuredClone(local[k]),
            ]),
          );
          if (cb) {
            cb(values);
            return;
          }
          return Promise.resolve(values);
        }),
        set: vi.fn((patch: Record<string, unknown>, cb?: Function) => {
          Object.assign(local, structuredClone(patch));
          if (cb) {
            cb();
            return;
          }
          return Promise.resolve();
        }),
      },
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!url.includes("/api/learn/"))
        return new Response(null, { status: 204 });
      if (offline) throw new Error("offline");
      urls.push(url);
      if (status !== 200) return new Response("{}", { status });
      const token =
        (init?.headers as Record<string, string>).Authorization?.replace(
          "Bearer ",
          "",
        ) || "";
      const user = owner(token);
      if (init?.method === "POST") {
        const { ops, epoch } = JSON.parse(String(init.body));
        posted.push({ token, ops: structuredClone(ops) });
        if (epoch !== undefined && epoch !== (epochs.get(user) || 0))
          return Response.json({ error: "epoch_changed" }, { status: 409 });
        if (ops.some((o: LearnOp) => refused.has(o.op_id)))
          return Response.json({ error: "word_not_found" }, { status: 404 });
        const hook = onPost;
        onPost = undefined;
        if (hook) await hook();
        for (const op of ops) serverOp(token, op);
        return Response.json({
          acknowledged: ops.map((o: LearnOp) => o.op_id),
        });
      }
      const params = new URL(url).searchParams;
      const since = Number(params.get("since"));
      const all = (logs.get(user) || []).filter((c) => c.cursor > since);
      const page = all.slice(0, Number(params.get("limit") ?? 2));
      return Response.json({
        userId: user,
        epoch: epochs.get(user) || 0,
        changes: page,
        cursor: page.at(-1)?.cursor || since,
        hasMore: all.length > 2,
      });
    }),
  );
});
describe("durable operation sync", () => {
  it("probes identity without downloading history", async () => {
    await judgeWord("猫", "learn", meta);
    await syncWithCloud();
    await syncWithCloud();
    const probes = urls.filter((u) => u.includes("since=0&limit=0"));
    expect(probes).toHaveLength(2);
  });

  it("sets aside a permanently rejected op and keeps syncing the rest", async () => {
    await judgeWord("猫", "learn", meta);
    const bad = newLearnOp("review", { base: "犬", result: "pass", day: "2026-11-01" });
    refused.add(bad.op_id);
    local.learnOutbox.push({ token: "token-a", ownerId: null, op: bad });
    await judgeWord("鳥", "learn", { ...meta, reading: "tori", gloss: "bird" });
    await syncWithCloud();
    expect(states.get("user-a")?.words.猫).toBeTruthy();
    expect(states.get("user-a")?.words.鳥).toBeTruthy();
    expect(local.learnOutbox).toEqual([]);
    expect(local.learnRejected).toMatchObject([{ op: { op_id: bad.op_id }, reason: "word_not_found" }]);
    expect(local.syncStatus.state).toBe("ok");
    // Later writes are not blocked by the rejected one.
    await judgeWord("魚", "learn", { ...meta, reading: "sakana", gloss: "fish" });
    await syncWithCloud();
    expect(states.get("user-a")?.words.魚).toBeTruthy();
  });

  it("keeps the outbox on transient conflicts", async () => {
    await judgeWord("猫", "learn", meta);
    status = 409;
    await syncWithCloud();
    expect(local.learnOutbox.length).toBeGreaterThan(0);
    expect(local.learnRejected).toBeUndefined();
    status = 200;
    await syncWithCloud();
    expect(local.learnOutbox).toEqual([]);
  });

  it("drops the erased epoch's cache and unsent writes after a data reset elsewhere", async () => {
    await judgeWord("猫", "learn", meta);
    await syncWithCloud();
    expect(local.learnEpoch).toBe(0);
    expect(local.vocab.猫).toBeTruthy();
    // The learner deletes their data on the site from another device.
    states.delete("user-a");
    logs.delete("user-a");
    epochs.set("user-a", 1);
    await judgeWord("犬", "learn", { ...meta, reading: "inu", gloss: "dog" });
    await syncWithCloud();
    expect(states.get("user-a")?.words || {}).toEqual({});
    expect(local.vocab).toEqual({});
    expect(local.learnOutbox).toEqual([]);
    expect(local.learnEpoch).toBe(1);
    expect(local.syncToken).toBe("token-a");
    await judgeWord("鳥", "learn", { ...meta, reading: "tori", gloss: "bird" });
    await syncWithCloud();
    expect(Object.keys(states.get("user-a")?.words || {})).toEqual(["鳥"]);
  });

  it("does not import an uninitialized previous account's cache into a different account",async()=>{
    local.vocab={猫:{state:"known",...meta,seenCount:1,shownCount:0,firstSeenAt:Date.now(),lastSeenAt:Date.now(),srs:null}};
    await setSyncToken("other-b");await syncWithCloud();
    expect(states.get("user-a")?.words.猫).toBeTruthy();
    expect(states.get("user-b")?.words || {}).toEqual({});
    expect(local.vocab).toEqual({});
  });

  it("persists a word and its outbox atomically before uploading", async () => {
    await judgeWord("猫", "learn", meta);
    expect(local.vocab.猫.state).toBe("learning");
    expect(local.learnOutbox.length).toBeGreaterThan(0);
    const writes = vi.mocked(chrome.storage.local.set).mock.calls;
    expect(writes.some(([p]) => p.vocab && p.learnOutbox)).toBe(true);
    await syncWithCloud();
    expect(states.get("user-a")?.words.猫.state).toBe("learning");
    expect(local.learnOutbox).toEqual([]);
    expect(local.syncStatus.state).toBe("ok");
  });
  it("retries the same operation IDs after offline failure and excludes the device key", async () => {
    local.settings = { openaiKey: "device-only-key" };
    await judgeWord("猫", "learn", meta);
    const ids = local.learnOutbox.map((p: PendingLearnOp) => p.op.op_id);
    offline = true;
    await syncWithCloud();
    expect(local.learnOutbox.map((p: PendingLearnOp) => p.op.op_id)).toEqual(
      ids,
    );
    offline = false;
    await syncWithCloud();
    expect(posted.flatMap((p) => p.ops.map((o) => o.op_id))).toEqual(
      expect.arrayContaining(ids),
    );
    expect(JSON.stringify(posted)).not.toContain("device-only-key");
    expect(local.settings.openaiKey).toBe("device-only-key");
  });
  it("does not import an already-applied local review and then apply it again", async () => {
    local.vocab = {
      猫: {
        state: "learning",
        ...meta,
        seenCount: 1,
        shownCount: 1,
        firstSeenAt: Date.now() - 100000,
        lastSeenAt: Date.now() - 10000,
        srs: { stage: 1, dueAt: Date.now() - 1, lapses: 0 },
      },
    };
    await judgeWord("猫", "review-pass", meta);
    expect(local.vocab.猫.srs.stage).toBe(2);
    await syncWithCloud();
    expect(states.get("user-a")?.words.猫.review?.stage).toBe(2);
    expect(local.vocab.猫.srs.stage).toBe(2);
    expect(
      (logs.get("user-a") || []).filter(
        (c) =>
          c.delta.daily?.[new Date().toLocaleDateString("sv")]?.reviews === 1,
      ).length,
    ).toBeGreaterThan(0);
  });
  it("keeps phone and extension reviews and does not replay acknowledged intent twice", async () => {
    await judgeWord("猫", "learn", meta);
    await syncWithCloud();
    serverOp(
      "token-a",
      newLearnOp("review", {
        base: "猫",
        result: "pass",
        day: new Date().toLocaleDateString("sv"),
      }),
    );
    await judgeWord("猫", "review-pass", meta);
    await syncWithCloud();
    expect(states.get("user-a")?.words.猫.review?.stage).toBe(3);
    expect(local.vocab.猫.srs.stage).toBe(3);
    expect(Object.values(states.get("user-a")!.daily)[0].reviews).toBe(2);
    await syncWithCloud();
    expect(local.vocab.猫.srs.stage).toBe(3);
  });
  it("retains writes added while a batch is in flight", async () => {
    await judgeWord("猫", "learn", meta);
    onPost = async () => {
      await judgeWord("犬", "learn", { ...meta, gloss: "dog" });
      void syncWithCloud();
    };
    await syncWithCloud();
    expect(Object.keys(states.get("user-a")!.words).sort()).toEqual(
      ["犬", "猫"].sort(),
    );
    expect(local.learnOutbox).toEqual([]);
  });
  it("pulls site settings while preserving a newer pending local setting", async () => {
    await syncWithCloud();
    serverOp(
      "token-a",
      newLearnOp("settings", {
        settings: { subLens: false, subLensPeek: false },
      }),
    );
    await setSettings({ cooldownSec: 7 });
    await syncWithCloud();
    expect(local.settings).toMatchObject({
      subLens: false,
      subLensPeek: false,
      cooldownSec: 7,
    });
  });
  it("keeps a signed-out save until linking, then imports only once", async () => {
    local.syncToken = "";
    await judgeWord("猫", "learn", meta);
    expect(local.learnOutbox.every((p: PendingLearnOp) => p.token === "")).toBe(
      true,
    );
    await setSyncToken("token-a");
    await syncWithCloud();
    const count = logs.get("user-a")!.length;
    await setSyncToken("token-a");
    await syncWithCloud();
    expect(logs.get("user-a")!.length).toBe(count);
    expect(Object.keys(states.get("user-a")!.words)).toEqual(["猫"]);
  });
  it("isolates pending writes across sign-out and account switching", async () => {
    await judgeWord("猫", "learn", meta);
    await syncWithCloud();
    await judgeWord("犬", "learn", { ...meta, gloss: "dog" });
    offline = true;
    await clearSignedOutCache();
    expect(local.vocab).toEqual({});
    await setSyncToken("other-b");
    await syncWithCloud();
    expect(
      local.learnOutbox.some((p: PendingLearnOp) => p.token === "token-a"),
    ).toBe(true);
    offline = false;
    await syncWithCloud();
    expect(Object.keys(states.get("user-a")!.words).sort()).toEqual(
      ["犬", "猫"].sort(),
    );
    expect(states.get("user-b")?.words || {}).toEqual({});
    expect(local.vocab).toEqual({});
    expect(
      posted
        .filter((p) => p.token === "other-b")
        .flatMap((p) => p.ops)
        .some((o) => (o.payload.word as any)?.base === "犬"),
    ).toBe(false);
  });
  it("uploads legacy detached snapshots with their outgoing credential", async () => {
    local.vocab = {
      猫: {
        state: "known",
        ...meta,
        seenCount: 1,
        shownCount: 0,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        srs: null,
      },
    };
    await clearSignedOutCache();
    local.syncToken = "other-b";
    await syncPendingSignouts();
    expect(local.pendingSignoutExports).toEqual([]);
    expect(states.get("user-a")?.words.猫).toBeTruthy();
    expect(states.get("user-b")).toBeUndefined();
  });
  it("keeps a token on a transient 401 and requests relinking after three", async () => {
    status = 401;
    await syncWithCloud();
    expect(local.syncToken).toBe("token-a");
    await syncWithCloud();
    await syncWithCloud();
    expect(local.syncToken).toBe("");
    expect(local.relinkNeeded).toBe(true);
  });
});
