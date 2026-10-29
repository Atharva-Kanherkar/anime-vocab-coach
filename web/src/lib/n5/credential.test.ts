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
it("uses the persisted unique credential even when concurrent cache-pointer writes are rate limited", async () => {
  let published = false;
  kv.put.mockImplementation(async (key, value) => {
    if (key === n5CredentialPointer("alice")) {
      if (published) throw new Error("KV PUT failed: 429 Too Many Requests");
      published = true;
    }
    kv.values.set(key, value);
  });
  const tokens = await Promise.all([courseCredential("alice"), courseCredential("alice")]);
  for (const token of tokens) expect(JSON.parse(kv.values.get(n5CredentialKey(token))!).id).toBe("alice");
});
it("fails closed if the authoritative credential record cannot be written", async () => {
  kv.put.mockRejectedValueOnce(new Error("KV unavailable"));
  await expect(courseCredential("alice")).rejects.toThrow("KV unavailable");
  expect(kv.put).toHaveBeenCalledTimes(1);
  expect(kv.values.has(n5CredentialPointer("alice"))).toBe(false);
});
it.each([1, 10_000, 30_000])("rotates a live credential with only %s ms remaining, with exactly one hour of validity", async (remaining) => {
  const now = 1_800_000_000_000;
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    kv.values.set(n5CredentialPointer("alice"), token);
    kv.values.set(n5CredentialKey(token), JSON.stringify({ id: "alice", expiresAt: now + remaining }));
    const fresh = await courseCredential("alice");
    expect(fresh).not.toBe(token);
    expect(JSON.parse(kv.values.get(n5CredentialKey(fresh))!)).toEqual({ id: "alice", expiresAt: now + 3_600_000 });
  } finally { clock.mockRestore(); }
});
