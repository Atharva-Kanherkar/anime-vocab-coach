// E2E for issue #162 in the extension: Pro in the popup at a value moment.
//
// A real Chromium loads the real unpacked extension. animevocab.com and
// api.animevocab.com are resolved to a local HTTPS server (same technique as
// e2e/learning-loop.mjs, and for the same reason: no route.fulfill, so every
// beacon is a real request that really left the browser). The server answers
// the two usage endpoints as a free account would and records /api/track.
//
//   node e2e/pro-popup.mjs [path/to/extension]
//   AVC_E2E_HEADED=1 node e2e/pro-popup.mjs
//
// Screenshots land in e2e/shots/ and the exit code is non-zero on any failure.
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const TEST_TOKEN = "avc_st_e2etoken0000000000";
/** What /api/me/usage answers. Mutated between cases. */
let plan = "free";

/** Every POST /api/track that reached the server, oldest first. */
const beacons = [];
/** Every page request (GET, not an API call), so an opened tab is visible. */
const pageLoads = [];
const pro = () => beacons.filter((b) => String(b.name).startsWith("pro_"));

const TLS_PORT = Number(process.env.AVC_E2E_PORT || 8444);
const certDir = mkdtempSync(join(tmpdir(), "avc-e2e-tls-"));
execFileSync(
  "openssl",
  [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(certDir, "key.pem"),
    "-out", join(certDir, "cert.pem"),
    "-days", "1",
    "-subj", "/CN=avc-e2e",
    "-addext", "subjectAltName=DNS:animevocab.com,DNS:api.animevocab.com",
  ],
  { stdio: "ignore" }
);

const tier = (name, priceLabel) => ({
  name,
  priceLabel,
  aiCallsPerMonth: 2500,
  listeningMinutes: 1200,
  checkoutUrl: `https://checkout.dodopayments.com/buy/${name.toLowerCase()}`,
});

const server = createServer(
  { key: readFileSync(join(certDir, "key.pem")), cert: readFileSync(join(certDir, "cert.pem")) },
  (req, res) => {
    const host = (req.headers.host || "").split(":")[0];
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const json = (body) =>
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (host === "api.animevocab.com" && req.url.startsWith("/v1/usage")) {
        return json({ plan, usedMinutes: 30, capMinutes: 600 });
      }
      if (req.url.startsWith("/api/me/usage")) {
        return json({
          plan,
          unlimited: false,
          // Well under 80%, so the old limit CTA stays away and only the value
          // moment can show.
          ai: { used: 12, limit: 300 },
          auto: { used: 40, limit: 1200 },
          tiers: { pro: tier("Pro", "$8/mo"), max: tier("Max", "$16/mo") },
        });
      }
      if (req.method === "GET" && !req.url.startsWith("/api/")) pageLoads.push(req.url);
      if (req.url === "/api/track" && req.method === "POST") {
        let body = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          /* ignore */
        }
        beacons.push({
          name: body.name,
          surface: body.surface,
          v: body.v,
          authorization: req.headers.authorization || null,
          origin: req.headers.origin || null,
        });
      }
      res.writeHead(204).end();
    });
  }
);
await new Promise((resolve) => server.listen(TLS_PORT, "127.0.0.1", resolve));

const ctx = await chromium.launchPersistentContext("", {
  // The full chromium channel: the default headless shell cannot load extensions.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${TLS_PORT},MAP api.animevocab.com 127.0.0.1:${TLS_PORT}`,
    "--ignore-certificate-errors",
  ],
});

async function waitFor(pred, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

const vocabOf = (n) =>
  Object.fromEntries(
    Array.from({ length: n }, (_, i) => [
      `語${i}`,
      {
        state: i % 3 === 0 ? "known" : "learning",
        reading: "ご",
        gloss: "word",
        level: 5,
        freqRank: 1000 + i,
        seenCount: 1,
        shownCount: 1,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        srs: null,
      },
    ])
  );

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const id = new URL(sw.url()).host;
  const seed = (values) => sw.evaluate((v) => chrome.storage.local.set(v), values);
  const read = (key) => sw.evaluate((k) => chrome.storage.local.get(k).then((r) => r[k]), key);

  // A linked, day-old install that has finished onboarding, so the checklist
  // and the review ask stay out of the way of what is under test.
  await seed({
    syncToken: TEST_TOKEN,
    syncProfile: { plan: "free", email: "learner@example.com" },
    onboarding: { installedAt: Date.now() - 86400e3 * 3, shownAt: 1, watchedAt: 1, cardShownAt: 1, firstCardAt: 1, celebratedAt: 1, checklistDismissedAt: 1 },
  });

  const openPopup = async () => {
    const page = await ctx.newPage();
    if (process.env.AVC_E2E_VERBOSE) page.on("console", (m) => console.log("   [popup]", m.type(), m.text()));
    page.on("pageerror", (e) => console.log("   [popup error]", String(e)));
    await page.setViewportSize({ width: 380, height: 640 });
    await page.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#usage:not([hidden])", { timeout: 8000 }).catch(() => {});
    return page;
  };

  // ── 1. an existing learner updating: no stale milestone ───────────────────
  await seed({ vocab: vocabOf(300) });
  await sw.evaluate(() => chrome.storage.local.remove("proMilestoneSeen"));
  let popup = await openPopup();
  check("the usage box renders for a linked free account", await popup.locator("#usage").isVisible());
  check("the quiet See Pro link is there", await popup.locator("#usage-see-pro").isVisible());
  check(
    "an existing 300-word deck is not greeted with an old milestone",
    (await popup.locator("#pro-moment").count()) === 0
  );
  check("that first count was stored silently (250)", (await read("proMilestoneSeen")) === 250, String(await read("proMilestoneSeen")));
  check(
    "the link counts as shown, once, with its surface",
    await waitFor(() => pro().some((b) => b.name === "pro_prompt_shown" && b.surface === "ext_popup")),
    JSON.stringify(pro())
  );
  await popup.close();

  // ── 2. crossing a milestone ───────────────────────────────────────────────
  beacons.length = 0;
  await seed({ vocab: vocabOf(12), proMilestoneSeen: 0 });
  popup = await openPopup();
  await popup.waitForSelector("#pro-moment", { timeout: 5000 }).catch(() => {});
  const moment = popup.locator("#pro-moment");
  check("crossing 10 words shows the milestone card", await moment.isVisible());
  const text = (await moment.innerText().catch(() => "")).replace(/\s+/g, " ");
  check("it names the milestone", text.includes("You've kept 10 words."), text);
  check(
    "it leads with the outcome, carries the price and the ownership line",
    text.includes("understand and remember the anime you watch") && text.includes("$8/mo") && text.includes("stay yours"),
    text
  );
  check("the copy has no em dash", !text.includes("—"), text);
  check(
    "the milestone card counts as shown with ext_milestone, under the learner",
    await waitFor(() =>
      pro().some(
        (b) => b.name === "pro_prompt_shown" && b.surface === "ext_milestone" && b.authorization === `Bearer ${TEST_TOKEN}`
      )
    ),
    JSON.stringify(pro())
  );
  check(
    "the beacon is sent by the service worker, not the page",
    pro().every((b) => String(b.origin).startsWith("chrome-extension://") || b.origin === null),
    JSON.stringify(pro().map((b) => b.origin))
  );
  await popup.screenshot({ path: `${SHOTS}/pro-popup-milestone.png` });

  await popup.locator("#pro-moment-see").click();
  // The tab it opens is observed where it lands: a real GET on the server.
  // (Playwright does not attach to a tab an extension opened, and without the
  // tabs permission its URL is hidden from the worker too.)
  const landed = await waitFor(() => pageLoads.some((u) => u.startsWith("/pricing?from=ext_milestone")));
  check("See Pro opens /pricing with the surface", landed, JSON.stringify(pageLoads));
  check(
    "and records the click with ext_milestone",
    await waitFor(() => pro().some((b) => b.name === "pro_prompt_clicked" && b.surface === "ext_milestone")),
    JSON.stringify(pro())
  );
  await popup.close().catch(() => {});

  popup = await openPopup();
  check("the milestone is shown once", (await popup.locator("#pro-moment").count()) === 0);
  check("the stored milestone advanced to 10", (await read("proMilestoneSeen")) === 10);
  await popup.close();

  // ── 3. a Pro account is never asked ───────────────────────────────────────
  plan = "pro";
  beacons.length = 0;
  await seed({ vocab: vocabOf(60), proMilestoneSeen: 10, syncProfile: { plan: "pro", email: "learner@example.com" } });
  popup = await openPopup();
  await popup.waitForTimeout(800);
  check("a Pro account sees no See Pro link", (await popup.locator("#usage-see-pro").count()) === 0);
  check("and no milestone card", (await popup.locator("#pro-moment").count()) === 0);
  check("and fires no Pro beacon", pro().length === 0, JSON.stringify(pro()));
  check("and its milestone is not consumed", (await read("proMilestoneSeen")) === 10);
  await popup.screenshot({ path: `${SHOTS}/pro-popup-pro-account.png` });
  await popup.close();
} finally {
  await ctx.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log(`failed: ${failed.map((f) => f.n).join(" | ")}`);
  process.exit(1);
}
