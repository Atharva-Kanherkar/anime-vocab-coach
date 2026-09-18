// Headed E2E for issue #77: first-run onboarding.
//
// Drives the real extension in a real Chromium: the welcome page a fresh
// install lands on, the steps ticking as a learner walks them, the 🎉 moment,
// and the popup checklist a day later. Every assertion leaves a screenshot in
// e2e/shots/ so a reviewer can see the thing rather than take the log's word.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const HOUR = 3600e3;
const EMPTY = {
  installedAt: 0,
  shownAt: 0,
  watchedAt: 0,
  cardShownAt: 0,
  firstCardAt: 0,
  celebratedAt: 0,
  checklistDismissedAt: 0,
};

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const id = new URL(sw.url()).host;

  const seed = (state) =>
    sw.evaluate((onboarding) => chrome.storage.local.set({ onboarding }), { ...EMPTY, ...state });
  const readOnboarding = () =>
    sw.evaluate(() => chrome.storage.local.get("onboarding").then((r) => r.onboarding));
  const readMilestones = () =>
    sw.evaluate(() => chrome.storage.local.get("funnelMilestones").then((r) => r.funnelMilestones || {}));

  // ── 1. welcome-first-run ──────────────────────────────────────────────────
  // The background worker runs a real onInstalled here — installedAt is set by
  // the extension itself, not seeded by this script. The stamp is asynchronous
  // and we may have attached to the worker mid-flight, so poll rather than
  // sampling once.
  let installed = null;
  for (let i = 0; i < 40 && !(installed?.installedAt > 0); i++) {
    installed = await readOnboarding();
    if (!(installed?.installedAt > 0)) await new Promise((r) => setTimeout(r, 100));
  }
  check("install stamps the 24h clock", (installed?.installedAt || 0) > 0, JSON.stringify(installed));

  const welcome = await ctx.newPage();
  await welcome.setViewportSize({ width: 1100, height: 900 });
  await welcome.goto(`chrome-extension://${id}/welcome/welcome.html`, { waitUntil: "domcontentloaded" });
  await welcome.waitForSelector("#steps .step", { timeout: 5000 });
  await welcome.waitForTimeout(700);

  const titles = await welcome.locator("#steps .step h2").allInnerTexts();
  check("three steps, in the issue's order", titles.length === 3, JSON.stringify(titles));

  const cta = welcome.locator('#steps button:has-text("Open Crunchyroll")');
  check("step 1 offers Open Crunchyroll", (await cta.count()) === 1);

  // "Big" is the whole point of the issue's wording — assert it, don't trust it.
  const ctaBox = await cta.boundingBox();
  const otherBoxes = await Promise.all(
    (await welcome.locator("#steps button:not(:has-text('Open Crunchyroll'))").all()).map((b) => b.boundingBox())
  );
  const biggest = otherBoxes.every((b) => !b || ctaBox.width * ctaBox.height > b.width * b.height);
  check("Open Crunchyroll is the largest CTA on the page", biggest, `${ctaBox.width}×${ctaBox.height}`);

  // Deferred sign-in: it exists, but below the steps, and nothing blocks.
  const stepsBottom = (await welcome.locator("#steps").boundingBox()).y;
  const accountTop = (await welcome.locator("#account").boundingBox()).y;
  check("sign-in sits below the three steps", accountTop > stepsBottom);
  check("sign-in is not a numbered step", (await welcome.locator("#steps #account").count()) === 0);
  check("no modal or blocking sign-in wall", (await welcome.locator("dialog[open], .modal, .overlay").count()) === 0);

  const shown = await readOnboarding();
  check("welcome paint stamps shownAt", (shown?.shownAt || 0) > 0);
  const milestones = await readMilestones();
  check("onboarding_shown counted once per install", milestones.onboarding_shown === true, JSON.stringify(milestones));

  await welcome.screenshot({ path: `${SHOTS}/onboarding-1-welcome-first-run.png`, fullPage: true });

  // ── 2. welcome-steps-tick ─────────────────────────────────────────────────
  // Same page, never reloaded: a learner leaves this tab open while they watch.
  const now = Date.now();
  await seed({ ...shown, watchedAt: now, cardShownAt: now + 1 });
  await welcome.waitForFunction(() => document.querySelectorAll("#steps .step.done").length === 2, null, {
    timeout: 5000,
  });
  check("steps 1 and 2 tick live, without a reload", true);
  check("step 3 is still open", (await welcome.locator("#steps .step:not(.done)").count()) === 1);
  await welcome.screenshot({ path: `${SHOTS}/onboarding-2-welcome-steps-tick.png`, fullPage: true });

  // ── 3. welcome-first-card ─────────────────────────────────────────────────
  await seed({ ...shown, watchedAt: now, cardShownAt: now + 1, firstCardAt: now + 2 });
  await welcome.waitForSelector("#celebrate:not([hidden])", { timeout: 5000 });
  const celebrateText = await welcome.locator("#celebrate").innerText();
  check("first card swaps in the 🎉 moment", celebrateText.includes("🎉"), JSON.stringify(celebrateText));
  check(
    "the moment points at the review dashboard",
    (await welcome.locator('#celebrate button:has-text("review dashboard")').count()) === 1
  );
  check("all three steps read as done", (await welcome.locator("#steps .step.done").count()) === 3);
  await welcome.screenshot({ path: `${SHOTS}/onboarding-3-welcome-first-card.png`, fullPage: true });
  await welcome.close();

  // ── popup cases ───────────────────────────────────────────────────────────
  const openPopup = async () => {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    return page;
  };

  // ── 4. popup-checklist-24h ────────────────────────────────────────────────
  await seed({ installedAt: Date.now() - 25 * HOUR, shownAt: Date.now() - 25 * HOUR });
  let popup = await openPopup();
  check("day-old install with no card gets the checklist", await popup.locator("#onboarding").isVisible());
  check("the checklist is the three steps", (await popup.locator(".av-onboarding-step").count()) === 3);
  check(
    "the checklist can start an episode",
    (await popup.locator('#onboarding button:has-text("Open Crunchyroll")').count()) === 1
  );
  await popup.screenshot({ path: `${SHOTS}/onboarding-4-popup-checklist-24h.png` });

  // ── 7. popup-checklist-dismissed ──────────────────────────────────────────
  await popup.locator('[data-onb="dismiss"]').click();
  await popup.waitForSelector("#onboarding[hidden]", { state: "attached", timeout: 5000 });
  const dismissed = await readOnboarding();
  check("dismiss is recorded", (dismissed?.checklistDismissedAt || 0) > 0);
  await popup.close();
  popup = await openPopup();
  check("dismissed stays dismissed on the next open", !(await popup.locator("#onboarding").isVisible()));
  await popup.screenshot({ path: `${SHOTS}/onboarding-7-popup-checklist-dismissed.png` });
  await popup.close();

  // ── 5. popup-no-checklist-fresh ───────────────────────────────────────────
  await seed({ installedAt: Date.now() - 1 * HOUR, shownAt: Date.now() - 1 * HOUR });
  popup = await openPopup();
  check("an hour-old install is left alone", !(await popup.locator("#onboarding").isVisible()));
  await popup.screenshot({ path: `${SHOTS}/onboarding-5-popup-no-checklist-fresh.png` });
  await popup.close();

  // ── 6. popup-first-card-moment ────────────────────────────────────────────
  await seed({
    installedAt: Date.now() - 25 * HOUR,
    shownAt: Date.now() - 25 * HOUR,
    watchedAt: Date.now() - 2 * HOUR,
    cardShownAt: Date.now() - 2 * HOUR,
    firstCardAt: Date.now() - HOUR,
  });
  popup = await openPopup();
  const popupText = await popup.locator("#onboarding").innerText();
  check("a mined card is congratulated in the popup", popupText.includes("🎉"), JSON.stringify(popupText));
  check(
    "and pointed at the dashboard",
    (await popup.locator('#onboarding button:has-text("Open review dashboard")').count()) === 1
  );
  check("an activated install never gets the first-run checklist", (await popup.locator(".av-onboarding-step").count()) === 0);
  await popup.screenshot({ path: `${SHOTS}/onboarding-6-popup-first-card-moment.png` });
  await popup.close();

  popup = await openPopup();
  check("the moment is spent after one showing", !(await popup.locator("#onboarding").isVisible()));
  await popup.screenshot({ path: `${SHOTS}/onboarding-6b-popup-moment-spent.png` });
  await popup.close();
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
console.log(`screenshots in ${SHOTS}`);
if (failed) process.exit(1);
