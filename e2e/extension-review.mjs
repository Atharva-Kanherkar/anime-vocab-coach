// Headed E2E: loads the built extension, seeds a due word, runs a standalone
// review session in the dashboard, and asserts the SRS advanced. Proves the
// review loop works without a video ever being on screen.
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
try {
  let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
  const id = new URL(sw.url()).host;

  // Seed one due learning word into the extension's storage via the SW.
  const dueAt = Date.now() - 100000;
  await sw.evaluate((dueAt) => chrome.storage.local.set({
    vocab: { "約束": { state: "learning", reading: "やくそく", gloss: "promise", level: 4, freqRank: 500, seenCount: 2, shownCount: 1, firstSeenAt: 1, lastSeenAt: 1, srs: { stage: 2, dueAt, lapses: 0 }, source: { title: "Attack on Titan", line: "約束を守る", en: null } } },
    stats: { daily: {}, cardTimestamps: [] },
  }), dueAt);

  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${id}/dashboard/dashboard.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);

  const reviewText = await page.locator("#review").innerText();
  check("review panel shows due count", /due/i.test(reviewText) && reviewText.includes("1"), JSON.stringify(reviewText));
  check("start button present", await page.locator("#review-start").count() === 1);

  await page.locator("#review-start").click();
  check("review word shown", (await page.locator(".review-word").innerText()).includes("約束"));
  // answer hidden until revealed
  check("answer hidden before reveal", await page.locator("#review-answer").isHidden());
  await page.locator("#review-show").click();
  const ans = await page.locator("#review-answer").innerText();
  check("answer reveals reading+gloss+source", ans.includes("やくそく") && ans.includes("promise") && ans.includes("約束を守る"));

  await page.locator("#review-got").click();
  await page.waitForTimeout(400); // let judgeWord enqueue flush

  const after = await sw.evaluate(() => chrome.storage.local.get("vocab").then((r) => r.vocab["約束"].srs));
  check("SRS advanced on pass (stage 2 → 3)", after.stage === 3, `stage ${after.stage}`);
  check("next review scheduled in the future", after.dueAt > Date.now(), `dueAt ${after.dueAt}`);
} finally {
  await ctx.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
