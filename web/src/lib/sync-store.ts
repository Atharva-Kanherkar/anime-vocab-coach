import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudSyncEnvelope, CloudUserProfile } from "./sync";

interface SyncKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface SyncEnv {
  AVC_SYNC_KV?: SyncKV;
}

function syncKey(userId: string): string {
  return `sync:user:${userId}:snapshot:v1`;
}

async function getKV(): Promise<SyncKV | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as SyncEnv).AVC_SYNC_KV ?? null;
  } catch {
    return null;
  }
}

// In-memory stand-in for `next dev`, where there is no KV binding. Never used in
// production: there we require the real binding so data can't silently vanish.
const devStore = new Map<string, string>();
const devKV: SyncKV = {
  get: async (k) => devStore.get(k) ?? null,
  put: async (k, v) => void devStore.set(k, v),
};

async function resolveStore(): Promise<SyncKV> {
  const kv = await getKV();
  if (kv) return kv;
  if (process.env.NODE_ENV !== "production") return devKV;
  throw new Error("AVC_SYNC_KV binding is required for cloud sync.");
}

export async function getCloudSyncEnvelope(userId: string): Promise<CloudSyncEnvelope | null> {
  const key = syncKey(userId);
  const store = await resolveStore();
  const raw = await store.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as CloudSyncEnvelope;
}

export async function putCloudSyncEnvelope(userId: string, envelope: CloudSyncEnvelope): Promise<void> {
  const key = syncKey(userId);
  const raw = JSON.stringify(envelope);
  const store = await resolveStore();
  await store.put(key, raw);
}

// Extension sync tokens: minted by a signed-in web session, then used by the
// extension as a long-lived bearer credential so it can push in the background
// without re-authing. The token maps to the profile it was minted for.
function tokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

export async function putSyncToken(token: string, profile: CloudUserProfile): Promise<void> {
  const store = await resolveStore();
  await store.put(tokenKey(token), JSON.stringify(profile));
}

export async function getSyncTokenProfile(token: string): Promise<CloudUserProfile | null> {
  if (!token) return null;
  const store = await resolveStore();
  const raw = await store.get(tokenKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as CloudUserProfile;
}
