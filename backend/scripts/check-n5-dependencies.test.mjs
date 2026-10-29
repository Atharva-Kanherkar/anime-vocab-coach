import assert from "node:assert/strict";
import { test } from "node:test";
import { assertN5DependencyParity } from "./check-n5-dependencies.mjs";

function fixture() {
  const manifest = { dependencies: { zod: "^4.6.7" } };
  const lock = { packages: { "": { dependencies: { zod: "^4.6.7" } }, "node_modules/zod": { version: "4.6.7" } } };
  return [structuredClone(manifest), structuredClone(lock), structuredClone(manifest), structuredClone(lock)];
}
test("matching root and backend dependency graphs pass", () => {
  assert.doesNotThrow(() => assertN5DependencyParity(...fixture()));
});
test("a one-sided locked version bump fails", () => {
  const inputs = fixture();
  inputs[3].packages["node_modules/zod"].version = "4.6.8";
  assert.throws(() => assertN5DependencyParity(...inputs), /locked Zod versions differ/);
});
test("missing dependencies and manifest range drift fail", () => {
  const inputs = fixture();
  inputs[2].dependencies.zod = "^4.6.8";
  assert.throws(() => assertN5DependencyParity(...inputs), /manifest ranges differ/);
  delete inputs[0].dependencies.zod;
  assert.throws(() => assertN5DependencyParity(...inputs), /missing/);
});
test("stale lock manifest ranges fail on either side", () => {
  for (const side of [1, 3]) {
    const inputs = fixture();
    inputs[side].packages[""].dependencies.zod = "^4.6.8";
    assert.throws(() => assertN5DependencyParity(...inputs), /lock manifest is stale/);
  }
});
