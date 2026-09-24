// E2E for issue #162 on the website: Pro entry points and the funnel they feed.
//
// Playwright against a real `next dev` (dev Clerk bypass, so the learner is the
// dev profile on the free plan), with Cloudflare's Analytics Engine SQL API
// mocked as in observability.mjs. The beacons asserted are the real requests
// the page sent to /api/track; only Dodo is blocked, so a checkout click does
// not leave the machine.
//
//   node web/e2e/pro-entry.mjs
//   BASE=http://localhost:3402 node web/e2e/pro-entry.mjs   (reuse a server)
//
// Screenshots land in web/e2e/shots/. Exit code is non-zero on any failure.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, "..");
const SHOTS = join(HERE, "shots");
mkdirSync(SHOTS, { recursive: true });

const PORT = Number(process.env.PORT || 3402);
const BASE = process.env.BASE || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE;

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

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
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

/** Every Pro funnel beacon the page sent, oldest first. */
const beacons = [];
page.on("request", (req) => {
  if (!req.url().endsWith("/api/track") || req.method() !== "POST") return;
  try {
    const b = JSON.parse(req.postData() || "{}");
    if (String(b.name).startsWith("pro_")) beacons.push({ name: b.name, surface: b.surface });
  } catch {
    /* not JSON */
  }
});
const saw = (name, surface) => beacons.some((b) => b.name === name && b.surface === surface);
async function waitFor(pred, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// Checkout stays on this machine.
await ctx.route("https://checkout.dodopayments.com/**", (r) => r.abort());

try {
  // ── /app: the header entry ────────────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  const entry = page.locator('[data-testid="pro-header-entry"]');
  check("a free learner sees the Go Pro entry in the /app header", await entry.isVisible());
  check("it counts as shown with app_header", await waitFor(() => saw("pro_prompt_shown", "app_header")), JSON.stringify(beacons));
  await page.screenshot({ path: join(SHOTS, "pro-app-header.png") });

  await entry.click();
  await page.waitForFunction(() => location.hash === "#billing", null, { timeout: 5000 }).catch(() => {});
  check("clicking it opens Billing", await page.locator('section[aria-label="Billing"]').isVisible());
  check("and records the click with app_header", await waitFor(() => saw("pro_prompt_clicked", "app_header")), JSON.stringify(beacons));
  check("Billing's upgrade cards count as shown once opened", await waitFor(() => saw("pro_prompt_shown", "app_billing")), JSON.stringify(beacons));

  // A Billing checkout is credited to the header entry that led there.
  beacons.length = 0;
  await page.locator('section[aria-label="Billing"] a:has-text("Get Pro")').first().click();
  check(
    "a Billing checkout is clicked on app_billing and credited to app_header",
    await waitFor(() => saw("pro_prompt_clicked", "app_billing") && saw("pro_checkout_started", "app_header")),
    JSON.stringify(beacons)
  );

  // ── /app: the card-unlock moment ──────────────────────────────────────────
  // Seed the account's snapshot with enough practice to pass level 1, exactly
  // as the extension would push it.
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  const pushed = await page.evaluate(async () => {
    const token = (await (await fetch("/api/sync/token", { method: "POST" })).json()).token;
    const auth = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const day = new Date().toISOString().slice(0, 10);
    const vocab = {};
    for (let i = 0; i < 40; i++) {
      vocab[`語${i}`] = {
        state: "learning", reading: "ご", gloss: "word", level: 5, freqRank: 1000 + i,
        seenCount: 1, shownCount: 1, firstSeenAt: Date.now(), lastSeenAt: Date.now(),
        srs: { stage: 1, dueAt: Date.now(), lapses: 0 },
      };
    }
    const cur = await fetch("/api/sync/snapshot", { headers: auth }).then((r) => r.json());
    const r = await fetch("/api/sync/snapshot", {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({
        expectedRevision: cur.envelope?.revision ?? null,
        export: {
          source: "animevocab-extension",
          exportedAt: new Date().toISOString(),
          settings: {},
          vocab,
          stats: { daily: { [day]: { met: 40, judged: 40, reviews: 10, watchMin: 30 } }, cardTimestamps: [] },
        },
      }),
    });
    return r.status;
  });
  check("the seeded snapshot is accepted", pushed === 200, String(pushed));

  // This browser last saw level 1, so the synced level is a fresh unlock.
  await page.evaluate(() => localStorage.setItem("avc_pro_seen_level", "1"));
  beacons.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  const moment = page.locator('[data-testid="unlock-moment"]');
  await moment.waitFor({ timeout: 8000 }).catch(() => {});
  check("a new unlock shows the moment", await moment.isVisible());
  const text = (await moment.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("it names the card and links to it", /joined your collection/.test(text) && (await moment.locator('a[href^="/app/cards/"]').count()) === 1, text);
  check(
    "it leads with the outcome and the ownership line",
    text.includes("understand and remember the anime you watch") && text.includes("stay yours"),
    text
  );
  check("the copy has no em dash", !text.includes("—"), text);
  check("it counts as shown with app_unlock", await waitFor(() => saw("pro_prompt_shown", "app_unlock")), JSON.stringify(beacons));
  const seen = await page.evaluate(() => Number(localStorage.getItem("avc_pro_seen_level")));
  check("the seen level advanced past 1", seen > 1, String(seen));
  await moment.screenshot({ path: join(SHOTS, "pro-app-unlock.png") });
  await page.screenshot({ path: join(SHOTS, "pro-app-unlock-page.png") });

  await moment.locator('button:has-text("Not now")').click();
  check("Not now dismisses it", (await moment.count()) === 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("and it does not come back for the same unlock", (await page.locator('[data-testid="unlock-moment"]').count()) === 0);

  // A browser with no stored level stores it silently: an import, not an unlock.
  await page.evaluate(() => localStorage.removeItem("avc_pro_seen_level"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("a first visit with existing progress shows no moment", (await page.locator('[data-testid="unlock-moment"]').count()) === 0);
  check(
    "but stores the level for next time",
    (await page.evaluate(() => localStorage.getItem("avc_pro_seen_level"))) === String(seen)
  );

  // ── /pricing?from=: an extension click keeps its credit ───────────────────
  const fresh = await ctx.newPage();
  fresh.on("request", (req) => {
    if (!req.url().endsWith("/api/track") || req.method() !== "POST") return;
    try {
      const b = JSON.parse(req.postData() || "{}");
      if (String(b.name).startsWith("pro_")) beacons.push({ name: b.name, surface: b.surface });
    } catch {
      /* ignore */
    }
  });
  beacons.length = 0;
  await fresh.goto(`${BASE}/pricing?from=ext_milestone`, { waitUntil: "networkidle" });
  const getPro = fresh.locator('.price-card-pro a:has-text("Get Pro")');
  await getPro.scrollIntoViewIfNeeded();
  check("the plan cards count as shown with pricing once seen", await waitFor(() => saw("pro_prompt_shown", "pricing")), JSON.stringify(beacons));
  await getPro.click();
  check(
    "a checkout from /pricing?from=ext_milestone is credited to ext_milestone",
    await waitFor(() => saw("pro_prompt_clicked", "pricing") && saw("pro_checkout_started", "ext_milestone")),
    JSON.stringify(beacons)
  );
  await fresh.close();

  // ── /owner: the Pro funnel panel ──────────────────────────────────────────
  await page.goto(`${BASE}/owner?h=24`, { waitUntil: "networkidle" });
  const panel = page.locator(".ow-panel", { has: page.locator("h2", { hasText: /^Pro funnel$/ }) });
  check("/owner has a Pro funnel panel", (await panel.count()) === 1);
  const rows = (await panel.locator("tbody tr").allInnerTexts()).map((r) => r.split("\t").map((c) => c.trim()));
  check("one row per surface, busiest first", rows.map((r) => r[0]).join(",") === "ext_milestone,app_unlock,app_billing", JSON.stringify(rows));
  const ext = rows.find((r) => r[0] === "ext_milestone");
  check("views discount the anonymous bucket (13 − 1 = 12 learners)", /40 · 12 learners/.test(ext?.[1] || ""), JSON.stringify(ext));
  check("click rate carries its n", ext?.[4] === "10% (n=40)", JSON.stringify(ext));
  check("a real 0% checkout rate is shown as 0%, with its n", ext?.[5] === "0.0% (n=4)", JSON.stringify(ext));
  const billing = rows.find((r) => r[0] === "app_billing");
  check("rates with no denominator read no data yet", billing?.[4] === "no data yet" && billing?.[5] === "no data yet", JSON.stringify(billing));
  await panel.screenshot({ path: join(SHOTS, "owner-pro-funnel.png") });

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
