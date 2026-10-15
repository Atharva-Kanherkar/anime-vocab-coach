// Accessibility e2e for the extension's own pages (ISO 25010 usability audit):
// axe-core (WCAG 2.0/2.1/2.2 A and AA, plus best practice) on the popup, the
// onboarding page, settings and the dashboard, in light and dark, at the
// popup's real width. Also checks the popup does not clip text at 320px.
//
//   node e2e/a11y-extension.mjs [path/to/extension]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { NO_PRODUCTION_ARGS, keepOffProduction } from "./support/no-production.mjs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
// Loaded through DevTools evaluation: extension pages' CSP (rightly) refuses
// an injected <script>, and a DevTools evaluation is not subject to it.
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const RULES = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const ctx = await chromium.launchPersistentContext("", {
  // The full chromium channel: the default headless shell cannot load extensions.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  args: [...NO_PRODUCTION_ARGS, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
// Beacons and the account-link probe stay off the real site (support/no-production.mjs).
await keepOffProduction(ctx);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 10000 }));
  const id = new URL(sw.url()).host;
  // A deck with something in every state, so the dashboard draws its charts,
  // its table and a due review.
  await sw.evaluate(() => {
    const now = Date.now();
    const day = new Date().toLocaleDateString("sv");
    const w = (state, extra = {}) => ({ state, reading: "やくそく", gloss: "promise", level: 4, freqRank: 500, seenCount: 3, shownCount: 1, firstSeenAt: now - 864e5, lastSeenAt: now, srs: null, ...extra });
    return chrome.storage.local.set({
      vocab: { 約束: w("learning", { srs: { stage: 2, dueAt: now - 1000, lapses: 0 } }), 猫: w("known"), 犬: w("new"), 鳥: w("ignored") },
      stats: { daily: { [day]: { met: 3, judged: 2, reviews: 1, watchMin: 12 } }, cardTimestamps: [] },
    });
  });

  const PAGES = [
    ["popup", "popup/popup.html", { width: 360, height: 600 }],
    ["onboarding", "welcome/welcome.html", { width: 1100, height: 800 }],
    ["settings", "options/options.html", { width: 1100, height: 800 }],
    ["dashboard", "dashboard/dashboard.html", { width: 1100, height: 800 }],
  ];
  for (const scheme of ["light", "dark"]) {
    for (const [name, path, viewport] of PAGES) {
      const page = await ctx.newPage();
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`chrome-extension://${id}/${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.evaluate(AXE);
      const violations = await page.evaluate(async (RULES) => {
        const r = await window.axe.run(document, { runOnly: RULES });
        return r.violations.map((v) => `${v.impact} ${v.id} x${v.nodes.length}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" ; ")}`);
      }, RULES);
      check(`${name} (${scheme}) has no axe violations`, violations.length === 0, violations.join(" | ").slice(0, 600));
      await page.close();
    }
  }

  // The popup at the narrowest width Chrome gives it: nothing cut off.
  const popup = await ctx.newPage();
  await popup.setViewportSize({ width: 320, height: 600 });
  await popup.goto(`chrome-extension://${id}/popup/popup.html`, { waitUntil: "domcontentloaded" });
  await popup.waitForTimeout(500);
  const clipped = await popup.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        // An ellipsis is still clipping: the reader never sees the rest.
        return el.children.length === 0 && el.textContent.trim() && el.offsetParent !== null &&
          el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible";
      })
      .map((el) => el.textContent.trim().slice(0, 40)));
  check("popup clips no text at 320px", clipped.length === 0, clipped.join(" | "));
  const wide = await popup.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("popup has no sideways scroll at 320px", wide <= 0, `${wide}px`);
} finally {
  await ctx.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
