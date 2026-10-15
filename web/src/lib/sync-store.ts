import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudSyncEnvelope, CloudUserProfile } from "./sync";

interface SyncKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete?(key: string): Promise<void>;
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
  delete: async (k) => void devStore.delete(k),
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

// Tokens are bearer credentials, so KV never holds one in the clear (ISO 25010
// security audit). Records are keyed by the token's SHA-256, and the reverse
// pointer holds that hash plus the token encrypted under a server secret; the
// encrypted copy is what lets a re-mint hand back the SAME token (the
// idempotency above) without storing it readable. Records and pointers from
// before this change (`synctoken:<token>:v1`, a plaintext pointer) are still
// honoured and are rewritten in the new form the first time they are used.
// backend/src/sync-auth.ts mirrors the lookup side.

export async function hashSyncToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenKey(hash: string): string {
  return `synctoken:h:${hash}:v1`;
}

/** Pre-hashing record key; read-only now, deleted on migration. */
function legacyTokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

function userTokenKey(userId: string): string {
  return `synctoken:user:${userId}:v1`;
}

/** What the reverse pointer holds: the token's hash, and (when the web app
 * wrote it) the token encrypted, as "<iv>.<ciphertext>" in base64. */
interface TokenPointer {
  h: string;
  e?: string;
}

type ParsedPointer = { kind: "hashed"; pointer: TokenPointer } | { kind: "legacy"; token: string };

function parsePointer(raw: string | null): ParsedPointer | null {
  if (!raw) return null;
  if (raw.startsWith("avc_st_")) return { kind: "legacy", token: raw };
  try {
    const p = JSON.parse(raw) as TokenPointer;
    return typeof p?.h === "string" ? { kind: "hashed", pointer: p } : null;
  } catch {
    return null;
  }
}

function pointerIsFor(raw: string | null, token: string, hash: string): boolean {
  const p = parsePointer(raw);
  if (!p) return false;
  return p.kind === "legacy" ? p.token === token : p.pointer.h === hash;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** AES-GCM key for the pointer's encrypted copy. SYNC_TOKEN_SECRET when set;
 * otherwise derived from the Clerk secret, which every deployed web Worker
 * already has. Rotating either only means the next mint issues a new token. */
async function pointerKey(): Promise<CryptoKey> {
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
  if (!secret) throw new Error("SYNC_TOKEN_SECRET (or CLERK_SECRET_KEY) is required to store sync tokens.");
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("avc-sync-token-pointer"), info: new Uint8Array() },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await pointerKey(), new TextEncoder().encode(token));
  return `${b64(iv)}.${b64(new Uint8Array(ct))}`;
}

async function decryptToken(sealed: string): Promise<string | null> {
  try {
    const [iv, ct] = sealed.split(".");
    if (!iv || !ct) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await pointerKey(), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

async function putTokenRecord(
  store: SyncKV,
  token: string,
  profile: CloudUserProfile,
  { takePointer = true, retireLegacy = false }: { takePointer?: boolean; retireLegacy?: boolean } = {}
): Promise<void> {
  const hash = await hashSyncToken(token);
  const record: StoredTokenProfile = { ...profile, touchedAt: Date.now() };
  await store.put(tokenKey(hash), JSON.stringify(record), {
    expirationTtl: SYNC_TOKEN_TTL_SECONDS,
  });
  if (takePointer) {
    const pointer: TokenPointer = { h: hash, e: await encryptToken(token) };
    await store.put(userTokenKey(profile.id), JSON.stringify(pointer), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  }
  // Retire the plaintext-keyed copy. Only when one existed: a KV delete is a
  // write against the free-tier budget.
  if (retireLegacy && store.delete) await store.delete(legacyTokenKey(token)).catch(() => {});
}

// Slide a token the extension is using. The pointer is only re-taken when it
// is ours or gone: a stale second token must not steal it from the current one,
// or plan refreshes (which follow the pointer) would miss the live credential.
async function touchTokenRecord(
  store: SyncKV,
  token: string,
  profile: CloudUserProfile,
  retireLegacy = false
): Promise<void> {
  const current = await store.get(userTokenKey(profile.id));
  const ours = !current || pointerIsFor(current, token, await hashSyncToken(token));
  await putTokenRecord(store, token, profile, { takePointer: ours, retireLegacy });
}

export async function getOrCreateSyncToken(
  userId: string,
  profile: CloudUserProfile
): Promise<string> {
  const store = await resolveStore();
  const existing = parsePointer(await store.get(userTokenKey(userId)));
  // Reuse the token the pointer names when it can be recovered: a legacy
  // plaintext pointer, or an encrypted copy this secret can open. A pointer
  // the API Worker wrote (hash only) cannot be reversed, so that case mints.
  const reused =
    existing?.kind === "legacy"
      ? existing.token
      : existing?.pointer.e
        ? await decryptToken(existing.pointer.e)
        : null;
  const token =
    reused ||
    "avc_st_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  // Reuse the existing token when present, otherwise mint one. Either way,
  // refresh the token→profile record and the reverse pointer with a sliding TTL
  // so an active user's token stays alive and a stale one expires on its own.
  await putTokenRecord(store, token, { ...profile, id: userId }, { retireLegacy: existing?.kind === "legacy" });
  return token;
}

export async function getSyncTokenProfile(token: string): Promise<CloudUserProfile | null> {
  if (!token) return null;
  const store = await resolveStore();
  let raw = await store.get(tokenKey(await hashSyncToken(token)));
  let legacy = false;
  if (!raw) {
    raw = await store.get(legacyTokenKey(token));
    legacy = !!raw;
  }
  if (!raw) return null;
  const { touchedAt, ...profile } = JSON.parse(raw) as StoredTokenProfile;
  if (legacy || tokenNeedsTouch({ touchedAt }, Date.now())) {
    // Best effort: a failed slide (or migration) must not turn a valid token
    // into a 401.
    try {
      await touchTokenRecord(store, token, profile, legacy);
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
  if (pointer.kind === "legacy") {
    // Rewrites the record under its hash and seals the pointer.
    await putTokenRecord(store, pointer.token, { ...profile, id: userId }, { retireLegacy: true });
    return true;
  }
  // The record is addressable by hash alone; no need to recover the token.
  const record: StoredTokenProfile = { ...profile, id: userId, touchedAt: Date.now() };
  await store.put(tokenKey(pointer.pointer.h), JSON.stringify(record), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  await store.put(userTokenKey(userId), pointerRaw!, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  return true;
}
