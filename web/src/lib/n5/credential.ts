import { resolveStore } from "@/lib/sync-store";
import { N5_CREDENTIAL_TTL_SECONDS, N5_TOKEN, n5CredentialKey, n5CredentialPointer, readN5Credential } from "./credential-record";

/** Only a verified, allowlisted web session may call this server-side helper. */
export async function courseCredential(ownerId: string): Promise<string> {
  const store = await resolveStore();
  const pointer = n5CredentialPointer(ownerId);
  const existing = await store.get(pointer);
  if (existing && N5_TOKEN.test(existing)) {
    const record = readN5Credential(await store.get(n5CredentialKey(existing)), Date.now(), ownerId);
    // Rotate before expiry rather than sending a credential that can expire in flight.
    if (record && record.expiresAt > Date.now() + 30_000) return existing;
  }
  const token = "avc_n5_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const options = { expirationTtl: N5_CREDENTIAL_TTL_SECONDS };
  await store.put(n5CredentialKey(token), JSON.stringify({ id: ownerId, expiresAt: Date.now() + N5_CREDENTIAL_TTL_SECONDS * 1000 }), options);
  // Parallel requests may hit KV's same-key write limit. The unique record
  // above is already usable; this pointer is only a cache for later requests.
  try { await store.put(pointer, token, options); } catch { /* best-effort cache */ }
  return token;
}
