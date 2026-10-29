import { beforeEach, expect, it, vi } from "vitest";
const kv = vi.hoisted(() => ({ values: new Map<string, string>(), get: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/sync-store", () => ({ resolveStore: async () => kv }));
import { courseCredential } from "./credential";
import { n5CredentialKey, n5CredentialPointer } from "../../../../shared/n5/credential";
const token = "avc_n5_" + "a".repeat(64);
beforeEach(() => {
  kv.values.clear();
  kv.get.mockReset().mockImplementation(async (key) => kv.values.get(key) ?? null);
  kv.put.mockReset().mockImplementation(async (key, value) => { kv.values.set(key, value); });
});
it("reuses course credentials without reads or writes to extension keys", async () => {
  kv.values.set(n5CredentialPointer("alice"), token);
  kv.values.set(n5CredentialKey(token), JSON.stringify({ id: "alice", expiresAt: Date.now() + 300_000 }));
  expect(await courseCredential("alice")).toBe(token);
  expect(kv.put).not.toHaveBeenCalled();
  expect(kv.get.mock.calls).toEqual([[n5CredentialPointer("alice")], [n5CredentialKey(token)]]);
});
it.each([
  null,
  "{",
  "null",
  JSON.stringify({ id: "bob", expiresAt: Date.now() + 300_000 }),
  JSON.stringify({ id: "alice", expiresAt: Date.now() - 1 }),
  JSON.stringify({ id: "alice", expiresAt: Date.now() + 10_000 }),
  JSON.stringify({ id: "alice", expiresAt: "tomorrow" }),
])("rotates missing, invalid, wrong-owner or expiring records: %s", async (raw) => {
  kv.values.set(n5CredentialPointer("alice"), token);
  if (raw !== null) kv.values.set(n5CredentialKey(token), raw);
  const fresh = await courseCredential("alice");
  expect(fresh).toMatch(/^avc_n5_[a-f0-9]{64}$/);
  expect(fresh).not.toBe(token);
  expect(JSON.parse(kv.values.get(n5CredentialKey(fresh))!).id).toBe("alice");
  expect(kv.put).toHaveBeenCalledTimes(2);
  expect(kv.put.mock.calls.every(([key, , opts]) => key.startsWith("n5token:") && opts.expirationTtl === 3600)).toBe(true);
});
it("does not follow a pointer to an extension credential", async () => {
  kv.values.set(n5CredentialPointer("alice"), "avc_st_extension");
  await courseCredential("alice");
  expect(kv.get).toHaveBeenCalledTimes(1);
  expect(kv.get.mock.calls[0][0]).toBe(n5CredentialPointer("alice"));
});
it("keeps concurrent first requests valid even if their pointers race", async () => {
  const [a, b] = await Promise.all([courseCredential("alice"), courseCredential("alice")]);
  expect(a).not.toBe(b);
  for (const key of [a, b]) expect(JSON.parse(kv.values.get(n5CredentialKey(key))!).id).toBe("alice");
  expect([a, b]).toContain(kv.values.get(n5CredentialPointer("alice")));
});
