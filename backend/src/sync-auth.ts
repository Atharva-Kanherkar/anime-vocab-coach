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

// Mirrors web/src/lib/sync-store.ts, release 1 of 2 of moving tokens off
// plaintext (review of #172, findings 1-2): this Worker reads both the
// plaintext record `synctoken:<token>:v1` and the hashed `synctoken:h:<sha256>:v1`,
// and both pointer forms (the token string, or JSON { h, e? }), but writes only
// what master wrote, in the layout it found. Nothing is migrated or deleted,
// so it interoperates with the old and the new site in either deploy order.

export async function hashSyncToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenKey(token: string): string {
  return `synctoken:${token}:v1`;
}

function hashedTokenKey(hash: string): string {
  return `synctoken:h:${hash}:v1`;
}

function userTokenKey(userId: string): string {
  return `synctoken:user:${userId}:v1`;
}

/** Whether a stored pointer names this token, in either form. */
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
  foundAt: string
): Promise<void> {
  const record: StoredTokenProfile = { ...profile, touchedAt: Date.now() };
  await kv.put(foundAt, JSON.stringify(record), { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  // Re-take the pointer only when it is ours or gone, so a stale second token
  // can't steal it from the one plan refreshes should reach. Ours is kept byte
  // for byte; a missing one is written the way master writes it.
  const current = await kv.get(userTokenKey(profile.id));
  if (!current) {
    await kv.put(userTokenKey(profile.id), token, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
  } else if (pointerIsFor(current, token, await hashSyncToken(token))) {
    await kv.put(userTokenKey(profile.id), current, { expirationTtl: SYNC_TOKEN_TTL_SECONDS });
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
  let foundAt = tokenKey(token);
  let raw = await kv.get(foundAt);
  if (!raw) {
    foundAt = hashedTokenKey(await hashSyncToken(token));
    raw = await kv.get(foundAt);
  }
  if (!raw) return null;
  const { touchedAt, ...profile } = JSON.parse(raw) as StoredTokenProfile;
  if (tokenNeedsTouch({ touchedAt }, Date.now())) {
    // Best effort: a failed slide must not turn a valid token into a 401.
    try {
      await touchToken(kv, token, profile, foundAt);
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
