import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudSyncEnvelope, CloudUserProfile } from "./sync";

interface SyncKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
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

// Exported so other stores (e.g. notebooks) share one KV accessor + dev fallback.
export async function resolveStore(): Promise<SyncKV> {
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
//
// Two properties this version enforces, both fixing the P0 token-mint runaway:
//   • TTL — tokens are no longer immortal. A ~30-day sliding TTL means an
//     abandoned token is reclaimed instead of littering KV forever, and it
//     gives sign-out an eventual expiry path.
//   • Idempotent per user — a reverse pointer (userId → current token) means
//     repeated mints from one page load reuse the SAME token instead of writing
//     a brand-new credential on every call.
const SYNC_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function tokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

function userTokenKey(userId: string): string {
  return `synctoken:user:${userId}:v1`;
}

export async function getOrCreateSyncToken(
  userId: string,
  profile: CloudUserProfile
): Promise<string> {
  const store = await resolveStore();
  const pointerKey = userTokenKey(userId);

  const existing = await store.get(pointerKey);
  const token =
    existing ||
    "avc_st_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  // Reuse the existing token when present, otherwise mint one. Either way,
  // refresh the token→profile record and the reverse pointer with a sliding TTL
  // so an active user's token stays alive and a stale one expires on its own.
  await store.put(tokenKey(token), JSON.stringify(profile), {
    expirationTtl: SYNC_TOKEN_TTL_SECONDS,
  });
  await store.put(pointerKey, token, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  return token;
}

export async function getSyncTokenProfile(token: string): Promise<CloudUserProfile | null> {
  if (!token) return null;
  const store = await resolveStore();
  const raw = await store.get(tokenKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as CloudUserProfile;
}
