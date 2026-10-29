import { expect, it } from "vitest";
import * as shared from "../../../../shared/n5/credential";
import * as local from "./credential-record";
it.each([shared, local])("validates exact owner, absolute expiry and projects only the credential identity", ({ readN5Credential, n5CredentialKey, n5CredentialPointer, N5_TOKEN }) => {
  const now = 1_800_000_000_000;
  const raw = JSON.stringify({ id: "alice", expiresAt: now + 1, plan: "max", userId: "bob" });
  expect(readN5Credential(raw, now, "alice")).toEqual({ id: "alice", expiresAt: now + 1 });
  expect(readN5Credential(raw, now)).toEqual({ id: "alice", expiresAt: now + 1 });
  expect(readN5Credential(raw, now, "bob")).toBeNull();
  expect(readN5Credential(raw, now + 1)).toBeNull();
  for (const invalid of [null, "{", "null", "[]", '"x"', JSON.stringify({ id: "", expiresAt: now + 1 }), JSON.stringify({ id: 12, expiresAt: now + 1 }), JSON.stringify({ id: "alice", expiresAt: String(now + 1) }), JSON.stringify({ id: "alice", expiresAt: now + 0.5 }), JSON.stringify({ id: "alice", expiresAt: Number.MAX_SAFE_INTEGER + 1 })]) {
    expect(readN5Credential(invalid, now)).toBeNull();
  }
  expect(n5CredentialKey("token")).toBe("n5token:token:v1");
  expect(n5CredentialPointer("alice")).toBe("n5token:user:alice:v1");
  expect(N5_TOKEN.test("avc_n5_" + "a".repeat(64))).toBe(true);
  for (const token of ["xavc_n5_" + "a".repeat(64), "avc_st_" + "a".repeat(64), "avc_n5_" + "g".repeat(64), "avc_n5_" + "a".repeat(63), "avc_n5_" + "a".repeat(65)]) expect(N5_TOKEN.test(token)).toBe(false);
});
