// Keep the dependency-free credential rules available inside Next's standalone
// package boundary. CI/builds reject drift from the shared API source.
import { readFile, writeFile } from "node:fs/promises";
const source = new URL("../../shared/n5/credential.ts", import.meta.url);
const target = new URL("../src/lib/n5/credential-record.ts", import.meta.url);
const expected = "// Mirror of shared/n5/credential.ts; update with scripts/sync-n5-credential.mjs.\n" + await readFile(source, "utf8");
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8").catch(() => "") !== expected) {
    throw new Error("N5 credential rules are stale; run node scripts/sync-n5-credential.mjs from web/.");
  }
} else {
  await writeFile(target, expected);
}
