import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Root builds and backend tests must exercise the same validator dependency. */
export function assertN5DependencyParity(rootManifest, rootLock, backendManifest, backendLock) {
  const range = rootManifest.dependencies?.zod;
  const dependency = rootLock.packages?.["node_modules/zod"];
  assert.ok(range && dependency?.version, "Root Zod dependency is missing");
  assert.equal(backendManifest.dependencies?.zod, range, "Root/backend Zod manifest ranges differ");
  assert.equal(rootLock.packages?.[""].dependencies?.zod, range, "Root Zod lock manifest is stale");
  assert.equal(backendLock.packages?.[""].dependencies?.zod, range, "Backend Zod lock manifest is stale");
  assert.equal(backendLock.packages?.["node_modules/zod"]?.version, dependency.version, "Root/backend locked Zod versions differ");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../../", import.meta.url);
  const files = ["package.json", "package-lock.json", "backend/package.json", "backend/package-lock.json"];
  const inputs = await Promise.all(files.map(async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"))));
  assertN5DependencyParity(...inputs);
  console.log(`Zod dependency parity verified for ${fileURLToPath(root)}`);
}
