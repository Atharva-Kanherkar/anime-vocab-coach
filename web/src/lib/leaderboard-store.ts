import { getCloudflareContext } from "@opennextjs/cloudflare";

// Weekly leaderboard + per-user privacy prefs, in the same KV as sync.
// Entry schema (issue #17 "leaderboard event schema"): one record per user per
// week, written server-side from the user's validated synced snapshot — never
// from client-supplied scores. userId is the storage key, never returned.
export interface LeaderboardEntry {
  userId: string;
  name: string;
  wordsReviewed: number;
  minutes: number;
  streak: number;
  updatedAt: string;
}

export interface LeaderboardPrefs {
  displayName: string;
  optOut: boolean;
}

// The public shape returned to clients — no userId.
export type PublicEntry = Omit<LeaderboardEntry, "userId">;

interface LbKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(opts: { prefix: string }): Promise<{ keys: { name: string }[] }>;
}

// Dev in-memory KV with prefix listing (no binding under `next dev`).
const devMap = new Map<string, string>();
const devKV: LbKV = {
  get: async (k) => devMap.get(k) ?? null,
  put: async (k, v) => void devMap.set(k, v),
  list: async ({ prefix }) => ({
    keys: [...devMap.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
  }),
};

async function kv(): Promise<LbKV> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as { AVC_SYNC_KV?: LbKV }).AVC_SYNC_KV;
    if (binding) return binding;
  } catch {
    /* no CF context in dev */
  }
  if (process.env.NODE_ENV !== "production") return devKV;
  throw new Error("AVC_SYNC_KV binding is required for the leaderboard.");
}

function entryKey(week: string, userId: string): string {
  return `lb:v1:${week}:${userId}`;
}
function prefsKey(userId: string): string {
  return `lbprefs:user:${userId}:v1`;
}

export async function getPrefs(userId: string): Promise<LeaderboardPrefs> {
  const store = await kv();
  const raw = await store.get(prefsKey(userId));
  if (!raw) return { displayName: "", optOut: false };
  try {
    const p = JSON.parse(raw) as Partial<LeaderboardPrefs>;
    return { displayName: typeof p.displayName === "string" ? p.displayName : "", optOut: !!p.optOut };
  } catch {
    return { displayName: "", optOut: false };
  }
}

export async function putPrefs(userId: string, prefs: LeaderboardPrefs): Promise<void> {
  const store = await kv();
  await store.put(prefsKey(userId), JSON.stringify(prefs));
}

/** Write (or remove) a user's entry for a week. Removes it when opted out. */
export async function upsertEntry(week: string, entry: LeaderboardEntry, optOut: boolean): Promise<void> {
  const store = await kv();
  const key = entryKey(week, entry.userId);
  if (optOut) {
    // No delete in the minimal KV interface; zero it out so it sorts to the
    // bottom and reads as inactive. (A real delete is a fast-follow.)
    await store.put(key, JSON.stringify({ ...entry, wordsReviewed: 0, minutes: 0, streak: 0, name: "" }));
    return;
  }
  await store.put(key, JSON.stringify(entry));
}

// Cap how many keys we pull to build a board — this is a niche app; a big global
// board would be sharded/paginated as a fast-follow.
const MAX_BOARD = 200;

export async function listWeek(week: string): Promise<LeaderboardEntry[]> {
  const store = await kv();
  const { keys } = await store.list({ prefix: `lb:v1:${week}:` });
  const out: LeaderboardEntry[] = [];
  for (const { name } of keys.slice(0, MAX_BOARD)) {
    const raw = await store.get(name);
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw) as LeaderboardEntry);
    } catch {
      /* skip corrupt */
    }
  }
  return out;
}
