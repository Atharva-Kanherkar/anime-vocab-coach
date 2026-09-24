// E2E for issue #163: /owner leaves the owner and test accounts out, says so,
// and puts them back on request.
//
// Playwright against a real `next dev` (dev Clerk bypass, so "the owner" is the
// dev profile), with the Analytics Engine SQL API mocked as in observability.mjs
// and every query it receives written to a log. The assertions are on that
// log: what /owner actually asked Analytics Engine for.
//
//   node web/e2e/owner-scope.mjs
//
// Needs its own server (the SQL log is wired at startup), so BASE is not
// supported. Screenshots land in web/e2e/shots/.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const SHOTS = join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });

const PORT = Number(process.env.PORT || 3403);
const BASE = `http://localhost:${PORT}`;
const OWN_SERVER = true;
const SQL_LOG = join(mkdtempSync(join(tmpdir(), "avc-e2e-sql-")), "sql.log");
writeFileSync(SQL_LOG, "");

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const DEV_ID = "dev-user";
const readSql = () =>
  readFileSync(SQL_LOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const clearSql = () => writeFileSync(SQL_LOG, "");
const onDataset = (sqls, ds) => sqls.filter((s) => new RegExp(`FROM ${ds}\\b`).test(s));

let server = null;
if (OWN_SERVER) {
  server = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    cwd: WEB,
    env: {
      ...process.env,
      NEXT_PUBLIC_AVC_DEV_NO_CLERK: "1",
      // Any non-empty pair: analyticsCredentials() only checks for presence,
      // and the request never leaves the process.
      CF_ACCOUNT_ID: "e2e-account",
      CF_ANALYTICS_API_TOKEN: "e2e-token",
      AVC_E2E_SQL_LOG: SQL_LOG,
      // --import, not --require: the preload is an ES module, so there is no
      // require() anywhere for the repo's eslint config to reject.
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import ${pathToFileURL(
        join(HERE, "support", "mock-cloudflare.mjs")
      )}`.trim(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (d) => {
    log += d;
    if (process.env.AVC_E2E_VERBOSE) process.stdout.write(`   [next] ${d}`);
  });
  server.stderr.on("data", (d) => {
    log += d;
    if (process.env.AVC_E2E_VERBOSE) process.stderr.write(`   [next] ${d}`);
  });

  process.stdout.write(`starting next dev on :${PORT} `);
  const deadline = Date.now() + 120000;
  for (;;) {
    if (Date.now() > deadline) {
      console.log(`\n${log.slice(-2000)}`);
      throw new Error("next dev did not come up in 120s");
    }
    try {
      const r = await fetch(`${BASE}/`, { method: "HEAD" });
      if (r.status < 500) break;
    } catch {
      /* not listening yet */
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(" up");
  check("the dev server loaded the SQL-API mock", log.includes("Cloudflare SQL API is mocked"));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ── default: excluding us ─────────────────────────────────────────────────
  clearSql();
  const res = await page.goto(`${BASE}/owner?h=24`, { waitUntil: "networkidle" });
  check("/owner renders", res?.status() === 200, `HTTP ${res?.status()}`);
  const scope = (await page.locator('[data-testid="owner-scope"]').innerText().catch(() => "")).replace(/\s+/g, " ");
  check("it says it is excluding the owner account", /Excluding 1 owner\/test account \(dev@animevocab\.test\)/.test(scope), scope);
  check("and that anonymous rows and the extension funnel still include us", /cannot be attributed/.test(scope), scope);

  let sqls = readSql();
  const userBearing = ["avc_llm", "avc_events", "avc_transcribe"].flatMap((ds) => onDataset(sqls, ds));
  check("it queried all three user-bearing datasets", ["avc_llm", "avc_events", "avc_transcribe"].every((ds) => onDataset(sqls, ds).length > 0), JSON.stringify(["avc_llm", "avc_events", "avc_transcribe"].map((ds) => onDataset(sqls, ds).length)));
  const missing = userBearing.filter((s) => !s.includes(`!= '${DEV_ID}'`));
  check(`every one of those ${userBearing.length} queries leaves the owner out`, missing.length === 0, missing[0]?.slice(0, 300));
  const funnel = onDataset(sqls, "extension_funnel");
  check("the extension funnel query, which has no user, is left alone", funnel.length === 1 && !funnel[0].includes(DEV_ID));
  const windows = await page.locator(".ow-windows a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("window links stay in the excluding mode", windows.length > 0 && windows.every((h) => !h.includes("all=1")), JSON.stringify(windows));
  check("the funnel panel says it includes us", (await page.locator(".ow-panel", { hasText: "Extension funnel" }).innerText().catch(() => "")).includes("always includes us"));
  await page.screenshot({ path: join(SHOTS, "owner-scope-excluding.png") });

  // ── ?all=1: everyone ──────────────────────────────────────────────────────
  clearSql();
  await page.locator('[data-testid="owner-scope"] a', { hasText: "Show everyone" }).click();
  await page.waitForURL(/all=1/, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
  const scopeAll = (await page.locator('[data-testid="owner-scope"]').innerText().catch(() => "")).replace(/\s+/g, " ");
  check("Show everyone switches to including us, and says so", /Including everyone/.test(scopeAll), scopeAll);
  sqls = readSql();
  check("no query leaves anyone out", sqls.length > 20 && sqls.every((s) => !s.includes(`!= '${DEV_ID}'`)), `${sqls.length} queries`);
  const windowsAll = await page.locator(".ow-windows a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check("window links keep all=1", windowsAll.every((h) => h.includes("all=1")), JSON.stringify(windowsAll));
  await page.screenshot({ path: join(SHOTS, "owner-scope-everyone.png") });

  // ── ?user=: the drill-down never excludes ─────────────────────────────────
  clearSql();
  await page.goto(`${BASE}/owner?h=24&user=${DEV_ID}`, { waitUntil: "networkidle" });
  sqls = readSql();
  const drill = ["avc_llm", "avc_events", "avc_transcribe"].flatMap((ds) => onDataset(sqls, ds));
  check("the owner can drill into their own rows", drill.length > 0 && drill.every((s) => s.includes(`= '${DEV_ID}'`) && !s.includes(`!= '${DEV_ID}'`)), drill.find((s) => !s.includes(`= '${DEV_ID}'`))?.slice(0, 300));
  check("with no exclusion line on a single learner's page", (await page.locator('[data-testid="owner-scope"]').count()) === 0);

  // ── AI insights ask for the same mode ─────────────────────────────────────
  await page.goto(`${BASE}/owner?h=24&all=1`, { waitUntil: "networkidle" });
  const insightsBody = page.waitForRequest((r) => r.url().endsWith("/api/owner/insights"), { timeout: 5000 }).catch(() => null);
  await page.locator(".ow-panel", { hasText: "AI insights" }).locator("button").first().click().catch(() => {});
  const req = await insightsBody;
  const sent = req ? JSON.parse(req.postData() || "{}") : null;
  check("AI insights are requested in the page's mode", sent?.all === true, JSON.stringify(sent));

  check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  if (server) server.kill("SIGTERM");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots in ${SHOTS}`);
if (failed.length) {
  console.log(`failed: ${failed.map((f) => f.n).join(" | ")}`);
  process.exit(1);
}
