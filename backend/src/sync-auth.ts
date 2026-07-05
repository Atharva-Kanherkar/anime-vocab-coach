// Validates extension sync tokens minted by the signed-in web app (Clerk).
// Tokens live in AVC_KV under synctoken:* — the same namespace as cloud sync.

export interface CloudUserProfile {
  id: string;
  email: string | null;
  name: string | null;
}

function tokenKey(token: string): string {
  return `synctoken:${token}:v1`;
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
  const raw = await kv.get(tokenKey(token));
  if (!raw) return null;
  return JSON.parse(raw) as CloudUserProfile;
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
