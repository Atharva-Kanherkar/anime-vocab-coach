// E2E (ISO 25010 reliability: recoverability): Export a backup from the
// settings page, lose the progress, Import the file back, get it all back.
// Also: an import merges (nothing already here is deleted), the file carries
// no OpenAI key, and a file that is not a backup is refused with a message.
//
//   node e2e/backup.mjs [path/to/extension]
import { chromium } from "playwright";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NO_PRODUCTION_ARGS, keepOffProduction } from "./support/no-production.mjs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };
const dir = mkdtempSync(join(tmpdir(), "avc-backup-"));
/** Key-order-independent equality: chrome.storage hands objects back with
 * their keys sorted. */
const same = (a, b) => {
  const canon = (v) => (v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
};

const ctx = await chromium.launchPersistentContext("", {
  // The full chromium channel: the default headless shell cannot load extensions.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  acceptDownloads: true,
  args: [...NO_PRODUCTION_ARGS, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
// Beacons and the account-link probe stay off the real site (support/no-production.mjs).
await keepOffProduction(ctx);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
  const id = new URL(sw.url()).host;
  const w = (state, extra = {}) => ({ state, reading: "よみ", gloss: "g", level: 3, freqRank: 900, seenCount: 2, shownCount: 1, firstSeenAt: 1, lastSeenAt: 2, srs: null, ...extra });
  const original = { 約束: w("learning", { srs: { stage: 3, dueAt: 9e12, lapses: 1 } }), 猫: w("known") };
  await sw.evaluate(async (vocab) => {
    const { settings } = await chrome.storage.local.get("settings");
    await chrome.storage.local.set({ vocab, stats: { daily: { "2026-10-01": { met: 2, judged: 2, reviews: 1, watchMin: 9 } }, cardTimestamps: [5] }, settings: { ...settings, openaiKey: "sk-e2e-do-not-export" } });
  }, original);

  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`chrome-extension://${id}/options/options.html`, { waitUntil: "domcontentloaded" });

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#export-btn")]);
  const file = join(dir, "backup.json");
  await download.saveAs(file);
  const text = readFileSync(file, "utf8");
  check("Export writes a backup with the words in it", text.includes("約束") && text.includes("猫"));
  check("the backup carries no OpenAI key", !text.includes("sk-e2e-do-not-export"));

  // Lose everything but one new word, then restore.
  await sw.evaluate((w) => chrome.storage.local.set({ vocab: { 犬: w }, stats: { daily: {}, cardTimestamps: [] } }), w("new"));
  await page.setInputFiles("#import-file", file);
  await page.waitForFunction(() => /Imported/.test(document.getElementById("backup-status").textContent || ""), null, { timeout: 5000 });
  const status = await page.textContent("#backup-status");
  check("Import reports what it did", /2 new words, 0 updated/.test(status), status);
  const after = await sw.evaluate(async () => (await chrome.storage.local.get("vocab")).vocab);
  check("every exported word is back, exactly", same(after["約束"], original["約束"]) && same(after["猫"], original["猫"]));
  check("the word added since the backup is still there", !!after["犬"]);

  const junk = join(dir, "junk.json");
  writeFileSync(junk, JSON.stringify({ hello: "world" }));
  await page.setInputFiles("#import-file", junk);
  await page.waitForFunction(() => /isn't an AnimeVocab backup/.test(document.getElementById("backup-status").textContent || ""), null, { timeout: 5000 }).catch(() => {});
  check("a file that is not a backup is refused with a message", /isn't an AnimeVocab backup/.test(await page.textContent("#backup-status")));
} finally {
  await ctx.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
