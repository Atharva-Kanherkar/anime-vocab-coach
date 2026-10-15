// Validates extension sync tokens minted by the signed-in web app (Clerk).
// Tokens live in AVC_KV under synctoken:* — the same namespace as cloud sync.

import type { Plan } from "./plan";

export interface CloudUserProfile {
  id: string;
  email: string | null;
  name: string | null;
  // Subscription tier, written by the web app from Clerk metadata when the
  // token is minted. Absent on tokens minted before tiers existed → free.
  plan?: Plan;
  billingInterval?: "monthly" | "yearly" | null;
  planExpiresAt?: string | null;
}

// Mirrors web/src/lib/sync-store.ts: records are keyed by the token's SHA-256,
// never the token itself, and the reverse pointer never holds it in the clear
// (ISO 25010 security audit). Pre-hashing records (`synctoken:<token>:v1`) are
// still honoured and are moved under the hash the first time they are used.
// This Worker has no key for the pointer's encrypted copy, so it only ever
// keeps an existing pointer as written or, when it must write one, stores the
// hash alone (the web app then mints a fresh token on its next visit).

export async function hashSyncToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenKey(hash: string): string {
  return `synctoken:h:${hash}:v1`;
}

function legacyTokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

function userTokenKey(userId: string): string {
  return `synctoken:user:${userId}:v1`;
}

/** Whether a stored pointer names this token: a legacy plaintext pointer, or
 * the JSON { h, e? } form keyed by hash. */
function pointerIsFor(raw: string, token: string, hash: string): boolean {
  if (raw.startsWith("avc_st_")) return raw === token;
  try {
    return (JSON.parse(raw) as { h?: string }).h === hash;
  } catch {
    return false;
  }
}

// Mirrors web/src/lib/sync-store.ts: using a token slides its 30-day TTL, at
// most once a day. Before this, only a web /app visit slid it, so a user who
// only ever used Listening Mode lost their session (and their plan) a month
// after their last visit to the site.
const SYNC_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const SYNC_TOKEN_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type StoredTokenProfile = CloudUserProfile & { touchedAt?: number };

export function tokenNeedsTouch(stored: { touchedAt?: number }, now: number): boolean {
  const at = stored.touchedAt;
  return typeof at !== "number" || now - at >= SYNC_TOKEN_TOUCH_INTERVAL_MS || at > now;
}

async function touchToken(
  kv: KVNamespace,
  token: string,
  profile: CloudUserProfile,
  retireLegacy: boolean
): Promise<void> {
  const hash = await hashSyncToken(token);
  const record: StoredTokenProfile = { ...profile, touchedAt: Date.now() };
  await kv.put(tokenKey(hash), JSON.stringify(record), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  if (retireLegacy) await kv.delete(legacyTokenKey(token)).catch(() => {});
  // Re-take the pointer only when it is ours or gone, so a stale second token
  // can't steal it from the one plan refreshes should reach. An encrypted
  // pointer is kept byte for byte; a plaintext one is replaced by the hash.
  const current = await kv.get(userTokenKey(profile.id));
  if (!current || pointerIsFor(current, token, hash)) {
    const keep = current && !current.startsWith("avc_st_") ? current : JSON.stringify({ h: hash });
    await kv.put(userTokenKey(profile.id), keep, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  }
}

export function bearerSyncToken(req: Request): string | null {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(avc_st_[A-Za-z0-9]+)$/);
  return m ? m[1] : null;
}

export async function getSyncTokenProfile(
  kv: KVNamespace,
  token: string
): Promise<CloudUserProfile | null> {
  if (!token) return null;
  let raw = await kv.get(tokenKey(await hashSyncToken(token)));
  let legacy = false;
  if (!raw) {
    raw = await kv.get(legacyTokenKey(token));
    legacy = !!raw;
  }
  if (!raw) return null;
  const { touchedAt, ...profile } = JSON.parse(raw) as StoredTokenProfile;
  if (legacy || tokenNeedsTouch({ touchedAt }, Date.now())) {
    // Best effort: a failed slide (or migration) must not turn a valid token
    // into a 401.
    try {
      await touchToken(kv, token, profile, legacy);
    } catch (err) {
      console.warn("[sync-auth] token TTL slide failed", err);
    }
  }
  return profile;
}

export async function requireAuth(
  kv: KVNamespace,
  req: Request,
  json: (req: Request, body: unknown, status?: number) => Response
): Promise<
  { ok: true; userId: string; profile: CloudUserProfile } | { ok: false; response: Response }
> {
  const token = bearerSyncToken(req);
  if (!token) {
    return {
      ok: false,
      response: json(
        req,
        { error: "sign in at animevocab.com and open the extension while signed in" },
        401
      )
    };
  }
  const profile = await getSyncTokenProfile(kv, token);
  if (!profile) {
    return {
      ok: false,
      response: json(req, { error: "session expired — reopen animevocab.com while signed in" }, 401)
    };
  }
  return { ok: true, userId: profile.id, profile };
}
