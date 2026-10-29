import { requireAuth } from "../sync-auth";
import { N5_TOKEN, n5CredentialKey, readN5Credential } from "../../../shared/n5/credential";

/** N5-only tokens cannot authenticate any ordinary extension/paid API route. */
export async function requireN5Auth(kv: KVNamespace, req: Request, json: Parameters<typeof requireAuth>[2]) {
  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token || !N5_TOKEN.test(token)) return requireAuth(kv, req, json);
  const record = readN5Credential(await kv.get(n5CredentialKey(token)), Date.now());
  return record
    ? { ok: true as const, userId: record.id }
    : { ok: false as const, response: json(req, { error: "Course session expired." }, 401) };
}
