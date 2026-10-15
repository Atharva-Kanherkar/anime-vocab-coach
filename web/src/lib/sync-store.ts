import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudSyncEnvelope, CloudUserProfile } from "./sync";

interface SyncKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface SyncEnv {
  AVC_SYNC_KV?: SyncKV;
  SYNC_TOKEN_SECRET?: string;
  CLERK_SECRET_KEY?: string;
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
// The TTL used to slide only when the web app minted, so an extension-only
// user (watching on another site, never reopening /app) was silently signed
// out 30 days after their last web visit, with a paid or gifted plan stuck on
// a dead credential. Using the token now slides it too, at most once a day so
// an active extension costs two KV writes a day, not two per request.
export const SYNC_TOKEN_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** What KV holds per token: the profile plus when its TTL last slid. */
type StoredTokenProfile = CloudUserProfile & { touchedAt?: number };

export function tokenNeedsTouch(stored: { touchedAt?: number }, now: number): boolean {
  const at = stored.touchedAt;
  return typeof at !== "number" || now - at >= SYNC_TOKEN_TOUCH_INTERVAL_MS || at > now;
}

// Token storage is moving off plaintext (ISO 25010 security audit), in two
// releases, because this Worker and the API Worker deploy one after the other
// and each must read whatever the other writes (review of #172, findings 1-2):
//
//   1. (this code) Readers understand both layouts: the plaintext record
//      `synctoken:<token>:v1` and the hashed `synctoken:h:<sha256>:v1`, and a
//      pointer that is either the token string or JSON { h, e? } (e = the
//      token sealed with AES-GCM). Writers still write only what master
//      wrote: the plaintext record and a token-string pointer. Nothing is
//      migrated or deleted, so old and new Workers interoperate in any order.
//   2. (follow-up, once 1 is live on both Workers) Writers switch to the
//      hashed record and the sealed pointer, migrate on use, and keep every
//      live token of a user reachable by entitlement refreshes.
//
// backend/src/sync-auth.ts mirrors the lookup side.

export async function hashSyncToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Where tokens are written today (and read first). */
function tokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

/** The hashed layout release 2 writes; read here so a rollback keeps working. */
function hashedTokenKey(hash: string): string {
  return `synctoken:h:${hash}:v1`;
}

function userTokenKey(userId: string): string {
  return `synctoken:user:${userId}:v1`;
}

/** Release 2's pointer: the token's hash and, from this Worker, the sealed token. */
interface SealedPointer {
  h: string;
  e?: string;
}

type ParsedPointer = { kind: "plain"; token: string } | { kind: "sealed"; pointer: SealedPointer };

function parsePointer(raw: string | null): ParsedPointer | null {
  if (!raw) return null;
  if (raw.startsWith("avc_st_")) return { kind: "plain", token: raw };
  try {
    const p = JSON.parse(raw) as SealedPointer;
    return typeof p?.h === "string" ? { kind: "sealed", pointer: p } : null;
  } catch {
    return null;
  }
}

function pointerIsFor(raw: string | null, token: string, hash: string): boolean {
  const p = parsePointer(raw);
  if (!p) return false;
  return p.kind === "plain" ? p.token === token : p.pointer.h === hash;
}

const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** AES-GCM key for a sealed pointer: SYNC_TOKEN_SECRET, else derived from the
 * Clerk secret every deployed web Worker has. */
async function pointerKey(): Promise<CryptoKey | null> {
  let env: SyncEnv = {};
  try {
    env = (await getCloudflareContext({ async: true })).env as SyncEnv;
  } catch {
    // next dev / tests: process.env below.
  }
  const secret =
    env.SYNC_TOKEN_SECRET ||
    process.env.SYNC_TOKEN_SECRET ||
    env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY ||
    (process.env.NODE_ENV !== "production" ? "avc-dev-only-sync-token-secret" : "");
  if (!secret) return null;
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("avc-sync-token-pointer"), info: new Uint8Array() },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function unsealToken(sealed: string): Promise<string | null> {
  try {
    const [iv, ct] = sealed.split(".");
    const key = await pointerKey();
    if (!iv || !ct || !key) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

async function putTokenRecord(
  store: SyncKV,
  token: string,
  profile: CloudUserProfile,
  { takePointer = true }: { takePointer?: boolean } = {}
): Promise<void> {
  const record: StoredTokenProfile = { ...profile, touchedAt: Date.now() };
  await store.put(tokenKey(token), JSON.stringify(record), {
    expirationTtl: SYNC_TOKEN_TTL_SECONDS,
  });
  if (takePointer) {
    await store.put(userTokenKey(profile.id), token, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  }
}

// Slide a token the extension is using, in the layout it was found in. The
// pointer is only re-taken when it is ours or gone: a stale second token must
// not steal it from the current one, or plan refreshes (which follow the
// pointer) would miss the live credential. Ours is kept byte for byte.
async function touchTokenRecord(
  store: SyncKV,
  token: string,
  profile: CloudUserProfile,
  foundAt: string
): Promise<void> {
  const record: StoredTokenProfile = { ...profile, touchedAt: Date.now() };
  await store.put(foundAt, JSON.stringify(record), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  const current = await store.get(userTokenKey(profile.id));
  if (!current) {
    await store.put(userTokenKey(profile.id), token, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  } else if (pointerIsFor(current, token, await hashSyncToken(token))) {
    await store.put(userTokenKey(profile.id), current, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  }
}

export async function getOrCreateSyncToken(
  userId: string,
  profile: CloudUserProfile
): Promise<string> {
  const store = await resolveStore();
  const existing = parsePointer(await store.get(userTokenKey(userId)));
  // Reuse the token the pointer names: a plain pointer, or a sealed one this
  // secret can open. Only an unreadable pointer mints a new token.
  const reused =
    existing?.kind === "plain"
      ? existing.token
      : existing?.pointer.e
        ? await unsealToken(existing.pointer.e)
        : null;
  const token =
    reused ||
    "avc_st_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  // Reuse the existing token when present, otherwise mint one. Either way,
  // refresh the token→profile record and the reverse pointer with a sliding TTL
  // so an active user's token stays alive and a stale one expires on its own.
  await putTokenRecord(store, token, { ...profile, id: userId });
  return token;
}

export async function getSyncTokenProfile(token: string): Promise<CloudUserProfile | null> {
  if (!token) return null;
  const store = await resolveStore();
  let foundAt = tokenKey(token);
  let raw = await store.get(foundAt);
  if (!raw) {
    foundAt = hashedTokenKey(await hashSyncToken(token));
    raw = await store.get(foundAt);
  }
  if (!raw) return null;
  const { touchedAt, ...profile } = JSON.parse(raw) as StoredTokenProfile;
  if (tokenNeedsTouch({ touchedAt }, Date.now())) {
    // Best effort: a failed slide must not turn a valid token into a 401.
    try {
      await touchTokenRecord(store, token, profile, foundAt);
    } catch (err) {
      console.warn("[sync-store] token TTL slide failed", err);
    }
  }
  return profile;
}

/**
 * Claim a one-shot marker, returning true only for the caller that created it.
 *
 * Used by the derived learning-loop events (#111), which are computed from a
 * snapshot diff on a route every extension push hits. The diff alone is not
 * enough: two syncs that race can both read the same previous envelope, both
 * see the day advance, and both emit `streak_day` — so a metric documented as
 * once-per-learner-per-day would quietly count twice.
 *
 * KV has no compare-and-set, so this is a read followed by a write and two
 * callers inside the same few milliseconds can still both claim. That is the
 * same limitation the envelope's optimistic revisions live with. It closes the
 * realistic window (the extension's debounced sync landing beside a web
 * import, seconds apart) rather than a simultaneous one, and it fails OPEN —
 * a KV hiccup emits the event rather than silently losing it, because an
 * occasional double count is a smaller lie than a missing day.
 */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const store = await resolveStore();
    if (await store.get(key)) return false;
    await store.put(key, "1", { expirationTtl: ttlSeconds });
    return true;
  } catch (err) {
    console.warn("[sync-store] once-marker failed, emitting anyway", err);
    return true;
  }
}

// Entitlement changes (Dodo webhook, Max-gift grant) must reach the extension's
// existing credential, not just the next mint: the backend Worker meters caps
// off the token-embedded profile, and extension-only users may not re-open the
// web app for weeks. Follows the userId → token pointer; no-op when the user
// has never minted a token. Returns whether a token profile was rewritten.
export async function refreshSyncTokenProfile(
  userId: string,
  profile: CloudUserProfile
): Promise<boolean> {
  const store = await resolveStore();
  const pointerRaw = await store.get(userTokenKey(userId));
  const pointer = parsePointer(pointerRaw);
  if (!pointer) return false;
  if (pointer.kind === "plain") {
    await putTokenRecord(store, pointer.token, { ...profile, id: userId });
    return true;
  }
  // A sealed pointer (release 2) addresses the hashed record by its hash.
  const record: StoredTokenProfile = { ...profile, id: userId, touchedAt: Date.now() };
  await store.put(hashedTokenKey(pointer.pointer.h), JSON.stringify(record), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  await store.put(userTokenKey(userId), pointerRaw!, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  return true;
}
