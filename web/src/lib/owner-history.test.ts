import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Clerk and a fake KV, so the whole history load runs as it would on
// the Worker: two signups of ours, and learners in every state #163 names.
const clerkUsers = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: { getUserList: async () => ({ data: clerkUsers.data }) },
  }),
}));
const kv = vi.hoisted(() => ({ store: new Map<string, string>(), failGet: new Set<string>() }));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => ({
    env: {
      AVC_SYNC_KV: {
        list: async ({ prefix }: { prefix: string }) => ({
          keys: [...kv.store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
          list_complete: true,
        }),
        get: async (k: string) => {
          if (kv.failGet.has(k)) throw new Error("kv 429");
          return kv.store.get(k) ?? null;
        },
      },
    },
  }),
}));

const { foldActivity, foldClerk, loadOwnerHistory, planBucket } = await import("./owner-history");

const NOW = Date.parse("2026-09-25T00:00:00Z");
const DAY = 86_400_000;
const future = new Date(NOW + 30 * DAY).toISOString();
const past = new Date(NOW - 30 * DAY).toISOString();

describe("planBucket (#163)", () => {
  it("reads free, paid and gifted plans by where they come from", () => {
    expect(planBucket({}, NOW).bucket).toBe("free");
    expect(planBucket(undefined, NOW).bucket).toBe("free");
    expect(planBucket({ plan: "pro", billingInterval: "monthly" }, NOW)).toMatchObject({
      bucket: "pro · paid",
      effective: "pro",
      expiresAt: null,
    });
    expect(planBucket({ plan: "max", billingInterval: "yearly" }, NOW).bucket).toBe("max · paid");
    expect(planBucket({ plan: "max", planExpiresAt: future }, NOW)).toMatchObject({
      bucket: "max · gift",
      effective: "max",
      expiresAt: future,
    });
    expect(planBucket({ plan: "pro", planExpiresAt: future }, NOW).bucket).toBe("pro · gift");
  });

  it("counts an expired gift as expired, now free, not as Max", () => {
    expect(planBucket({ plan: "max", planExpiresAt: past }, NOW)).toMatchObject({
      bucket: "gift expired",
      effective: "free",
      raw: "max",
    });
  });

  it("treats a malformed expiry the way the meters do: free", () => {
    expect(planBucket({ plan: "max", planExpiresAt: "garbage" }, NOW)).toMatchObject({
      bucket: "gift expired",
      effective: "free",
    });
  });
});

describe("foldActivity (#163)", () => {
  it("splits never linked from linked with no card, and counts only those as never active", () => {
    const out = foldActivity([
      { linked: false, hasBackup: false, words: 0 }, // never linked
      { linked: true, hasBackup: false, words: 0 }, // linked, no card
      { linked: false, hasBackup: true, words: 0 }, // link expired, empty backup
      { linked: false, hasBackup: true, words: 12 }, // active, link long expired
      { linked: true, hasBackup: true, words: 3 }, // active
    ]);
    expect(out).toEqual({ neverActive: 3, neverLinked: 1, linkedNoCard: 2, unknown: 0 });
  });

  it("leaves an unread backup out of both, rather than calling it inactive", () => {
    expect(foldActivity([{ linked: true, hasBackup: true, words: null }])).toEqual({
      neverActive: 0,
      neverLinked: 0,
      linkedNoCard: 0,
      unknown: 1,
    });
  });
});

describe("foldClerk", () => {
  it("counts signups by month and plan bucket, and 30-day activity", () => {
    const out = foldClerk(
      [
        { id: "user_a", createdAt: Date.parse("2026-07-03"), lastActiveAt: NOW - DAY, plan: planBucket({}, NOW) },
        { id: "user_b", createdAt: Date.parse("2026-08-10"), lastActiveAt: NOW - 60 * DAY, plan: planBucket({ plan: "max", planExpiresAt: past }, NOW) },
        { id: "user_c", createdAt: Date.parse("2026-08-11"), lastActiveAt: null, plan: planBucket({}, NOW) },
      ],
      NOW
    );
    expect(out.signupsByMonth).toEqual([
      { month: "2026-07", signups: 1 },
      { month: "2026-08", signups: 2 },
    ]);
    expect(out.activeLast30).toBe(1);
    expect(out.usersByPlan).toEqual([
      { label: "free", value: 2 },
      { label: "gift expired", value: 1 },
    ]);
  });
});

describe("loadOwnerHistory with exclusions (#163)", () => {
  const user = (id: string, meta: Record<string, unknown> = {}, email = `${id}@x.io`) => ({
    id,
    createdAt: Date.parse("2026-08-01"),
    lastActiveAt: Date.now(),
    publicMetadata: meta,
    primaryEmailAddress: { emailAddress: email },
  });
  const backup = (words: number) => JSON.stringify({ snapshot: { words: Array.from({ length: words }, () => ({})) } });

  beforeEach(() => {
    kv.store.clear();
    kv.failGet.clear();
    clerkUsers.data = [
      user("user_owner", { plan: "max" }, "owner@x.io"),
      user("user_paid", { plan: "pro", billingInterval: "monthly" }),
      user("user_gift", { plan: "max", planExpiresAt: new Date(Date.now() + 9 * DAY).toISOString() }),
      user("user_expired", { plan: "max", planExpiresAt: new Date(Date.now() - 9 * DAY).toISOString() }),
      user("user_never"),
      user("user_nocard"),
    ];
    // The owner: linked, a big backup, most of the listening.
    kv.store.set("synctoken:user:user_owner", "tok");
    kv.store.set("sync:user:user_owner:snapshot:v1", backup(400));
    kv.store.set("use:user_owner:2026-09", "123");
    // Learners.
    kv.store.set("synctoken:user:user_paid", "tok");
    kv.store.set("sync:user:user_paid:snapshot:v1", backup(20));
    kv.store.set("use:user_paid:2026-09", "30");
    kv.store.set("sync:user:user_gift:snapshot:v1", backup(5));
    kv.store.set("synctoken:user:user_nocard", "tok");
    kv.store.set("sync:user:user_nocard:snapshot:v1", backup(0));
    kv.store.set("sync:user:user_expired:snapshot:v1", backup(2));
    // Not a backup key, must be ignored.
    kv.store.set("sync:user:user_paid:notebooks:v1", "{}");
  });

  it("leaves excluded accounts out of every all-time count", async () => {
    const h = await loadOwnerHistory({ exclude: ["user_owner"] });
    expect(h.totalUsers).toBe(5);
    expect(h.excludedCount).toBe(1);
    expect(h.linkedUsers).toBe(2);
    expect(h.activationRate).toBeCloseTo(2 / 5);
    expect(h.totalListeningMinutes).toBe(30);
    expect(h.topListeners.map((t) => t.userId)).toEqual(["user_paid"]);
    expect(h.planAccounts.map((a) => a.id).sort()).toEqual(["user_expired", "user_gift", "user_paid"]);
  });

  it("counts us when asked to include everyone", async () => {
    const h = await loadOwnerHistory({ exclude: [] });
    expect(h.totalUsers).toBe(6);
    expect(h.totalListeningMinutes).toBe(153);
    expect(h.planAccounts.map((a) => a.id)).toContain("user_owner");
  });

  it("buckets plans by source", async () => {
    const h = await loadOwnerHistory({ exclude: ["user_owner"] });
    const byLabel = Object.fromEntries(h.usersByPlan.map((p) => [p.label, p.value]));
    expect(byLabel).toEqual({ free: 2, "pro · paid": 1, "max · gift": 1, "gift expired": 1 });
  });

  it("defines never active as no saved word, split by whether they linked", async () => {
    const h = await loadOwnerHistory({ exclude: ["user_owner"] });
    // user_never: nothing at all. user_nocard: linked, empty backup.
    expect(h.neverLinked).toBe(1);
    expect(h.linkedNoCard).toBe(1);
    expect(h.neverActive).toBe(2);
  });

  it("reports an unreadable backup as a lower bound, not as inactive", async () => {
    kv.failGet.add("sync:user:user_nocard:snapshot:v1");
    const h = await loadOwnerHistory({ exclude: ["user_owner"] });
    expect(h.neverActive).toBe(1);
    expect(h.notes.join(" ")).toMatch(/could not be read; never active is a lower bound/);
  });
});
