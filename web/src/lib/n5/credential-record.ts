// Mirror of shared/n5/credential.ts; update with scripts/sync-n5-credential.mjs.
/** Server-only course credentials. These never represent an extension link. */
export const N5_CREDENTIAL_TTL_SECONDS = 3600;
export const N5_TOKEN = /^avc_n5_[a-f0-9]{64}$/;
export const n5CredentialKey = (token: string) => `n5token:${token}:v1`;
export const n5CredentialPointer = (ownerId: string) => `n5token:user:${ownerId}:v1`;
export interface N5Credential { id: string; expiresAt: number }

export function readN5Credential(raw: string | null, now: number, ownerId?: string): N5Credential | null {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record || typeof record.id !== "string" || !record.id ||
        (ownerId !== undefined && record.id !== ownerId) ||
        !Number.isSafeInteger(record.expiresAt) || record.expiresAt <= now) return null;
    return { id: record.id, expiresAt: record.expiresAt };
  } catch { return null; }
}
