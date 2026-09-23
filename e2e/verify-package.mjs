// Release gate: smoke-test the ACTUAL shipping artifact.
//
// Unpacks dist/anime-vocab-coach.zip into a temp dir and loads THAT in a clean Chromium.
// Loading extension/ instead would test the build tree, not the thing that gets uploaded
// to the Chrome Web Store — and the two can differ (a file the pack script excludes, a
// stale bundle, a version that was bumped in the manifest but never rebuilt).
//
//   npm run pack && npm run verify:package
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "avc-pkg-"));
execFileSync("unzip", ["-q", "dist/anime-vocab-coach.zip", "-d", dir]);
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

check("manifest version is 0.6.0", manifest.version === "0.6.0", manifest.version);
check("manifest v3", manifest.manifest_version === 3);
check("service worker declared", !!manifest.background?.service_worker, manifest.background?.service_worker);

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [
    `--disable-extensions-except=${dir}`, `--load-extension=${dir}`,
    // Black-hole the real host: this version fires install_first_run on install and
    // a test run must never write into production telemetry.
    "--host-resolver-rules=MAP animevocab.com 127.0.0.1:1,MAP api.animevocab.com 127.0.0.1:1",
  ],
});
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 20000 }));
  check("service worker boots from the packaged build", !!sw);
  const id = new URL(sw.url()).host;

  // Both are written asynchronously on separate queues, so poll for each on its own —
  // returning as soon as `settings` lands raced the onboarding stamp and read null.
  const seeded = await sw.evaluate(async () => {
    const until = async (pick) => {
      for (let i = 0; i < 60; i++) {
        const v = pick(await chrome.storage.local.get(["settings", "onboarding"]));
        if (v) return v;
        await new Promise((x) => setTimeout(x, 100));
      }
      return null;
    };
    return {
      settings: !!(await until((r) => r.settings)),
      installedAt: (await until((r) => r.onboarding?.installedAt)) || 0,
    };
  });
  check("onInstalled seeds default settings", seeded.settings);
  check("install stamps the onboarding clock", seeded.installedAt > 0, String(seeded.installedAt));

  const errs = [];
  const welcome = await ctx.newPage();
  welcome.on("pageerror", (e) => errs.push(String(e)));
  welcome.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await welcome.goto(`chrome-extension://${id}/welcome/welcome.html`, { waitUntil: "domcontentloaded" });
  await welcome.waitForSelector("#steps .step", { timeout: 8000 });
  const steps = await welcome.locator("#steps .step h2").allInnerTexts();
  check("welcome page renders its three steps", steps.length === 3, JSON.stringify(steps));

  const popup = await ctx.newPage();
  popup.on("pageerror", (e) => errs.push(String(e)));
  popup.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await popup.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: "domcontentloaded" });
  await popup.waitForTimeout(1200);
  check("popup renders", (await popup.locator("body").innerText()).length > 20);

  const dash = await ctx.newPage();
  dash.on("pageerror", (e) => errs.push(String(e)));
  await dash.goto(`chrome-extension://${id}/dashboard/dashboard.html`, { waitUntil: "domcontentloaded" });
  await dash.waitForTimeout(1200);
  check("dashboard renders", (await dash.locator("body").innerText()).length > 20);

  // Network failures to the black-holed host are expected; real page errors are not.
  const real = errs.filter((e) => !/Failed to (load resource|fetch)|ERR_|net::/i.test(e));
  check("no page errors in the extension's own pages", real.length === 0, real.slice(0, 3).join(" | "));
} finally {
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
