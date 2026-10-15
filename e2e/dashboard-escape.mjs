// E2E (ISO 25010 security audit): words and glosses that carry markup are shown
// as text on the dashboard, never parsed as HTML.
//
// Words come from subtitles and glosses can come from a model reading them, so
// either can contain "<". The word table used to interpolate them raw into
// innerHTML. MV3's default CSP already blocks inline script, so the risk was
// injected markup (links, forms, styling), which this asserts never appears.
//
//   node e2e/dashboard-escape.mjs [path/to/extension]
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const WORD = '<a id="planted-link" href="https://evil.example">約束</a>';
const GLOSS = '<img id="planted-img" src="x"><form id="planted-form"></form>promise';

const ctx = await chromium.launchPersistentContext("", {
  // The full chromium channel: the default headless shell cannot load extensions.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
  const id = new URL(sw.url()).host;
  await sw.evaluate(({ WORD, GLOSS }) => chrome.storage.local.set({
    vocab: { [WORD]: { state: "learning", reading: "<b id=\"planted-b\">やくそく</b>", gloss: GLOSS, level: 4, freqRank: 500, seenCount: 2, shownCount: 1, firstSeenAt: 1, lastSeenAt: 1, srs: { stage: 2, dueAt: Date.now() + 1e9, lapses: 0 }, source: null } },
    stats: { daily: {}, cardTimestamps: [] },
  }), { WORD, GLOSS });

  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/dashboard/dashboard.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  const planted = await page.evaluate(() =>
    ["planted-link", "planted-img", "planted-form", "planted-b"].filter((x) => document.getElementById(x)));
  check("no planted element was created", planted.length === 0, planted.join(",") || "none");
  const rowText = await page.locator("tbody tr").first().innerText();
  check("the word shows as literal text", rowText.includes('<a id="planted-link"'), rowText.slice(0, 80));
  check("the gloss shows as literal text", rowText.includes("<img id=\"planted-img\""));
} finally {
  await ctx.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
