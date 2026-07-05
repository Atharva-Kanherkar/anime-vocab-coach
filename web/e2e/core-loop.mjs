// End-to-end smoke test for the web core loop, driven by Playwright against a
// running `next dev` with the dev Clerk bypass (NEXT_PUBLIC_AVC_DEV_NO_CLERK=1).
//
//   Terminal A: cd web && NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 PORT=3400 npm run dev
//   Terminal B: node web/e2e/core-loop.mjs           (or BASE=http://... node ...)
//
// Exits non-zero on the first failed assertion. Covers: signed-in dashboard
// render, the extension token→snapshot→readback sync loop, the AI coach, and a
// clean (no-Clerk-crash) marketing homepage.
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3400";
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

try {
  // 1. Signed-in dashboard renders under the dev bypass.
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  // innerText reflects CSS text-transform (the eyebrow is uppercased), so match
  // case-insensitively.
  const appText = (await page.locator("body").innerText()).toLowerCase();
  check("dashboard shows dev identity", appText.includes("signed in as dev learner"));
  check("dashboard shows reviews-due tile", appText.includes("reviews due"));

  // 2. ExtensionConnector minted + broadcast a token in-browser.
  await page.waitForFunction(
    () => document.body.innerText.includes("Extension linked") ||
          document.body.innerText.includes("Couldn't link"),
    { timeout: 10000 }
  );
  const linked = (await page.locator("body").innerText()).includes("Extension linked");
  check("extension connector links (token minted client-side)", linked);

  // 3. Sync loop the extension uses: mint token → push raw export → read back.
  const loop = await page.evaluate(async () => {
    const t = await (await fetch("/api/sync/token", { method: "POST" })).json();
    const token = t.token;
    // Mirror the extension: GET the current revision first, then PUT with it so
    // optimistic concurrency is satisfied (avoids a spurious 409 on re-runs).
    const cur = await (await fetch("/api/sync/snapshot", { headers: { Authorization: "Bearer " + token } })).json();
    const expectedRevision = cur.envelope?.revision ?? null;
    const put = await fetch("/api/sync/snapshot", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        export: {
          exportedAt: "2026-07-05T00:00:00.000Z",
          settings: { targetLevel: 3 },
          vocab: { "猫": { state: "learning", reading: "ねこ", gloss: "cat", level: 5, freqRank: 900, seenCount: 3, shownCount: 1, firstSeenAt: 1704067200000, lastSeenAt: 1704067200000, srs: { stage: 2, dueAt: 1704153600000, lapses: 0 } } },
          stats: { daily: { "2026-07-05": { met: 1, judged: 1, reviews: 0, watchMin: 12 } }, cardTimestamps: [1704067200000] },
        },
        expectedRevision,
      }),
    });
    const get = await fetch("/api/sync/snapshot", { headers: { Authorization: "Bearer " + token } });
    const getBody = await get.json();
    return { hasToken: !!token, putStatus: put.status, getWords: (getBody.envelope?.snapshot?.words || []).map((w) => w.base) };
  });
  check("token minted", loop.hasToken);
  check("snapshot PUT ok", loop.putStatus === 200, `status ${loop.putStatus}`);
  check("snapshot round-trips the word", loop.getWords.includes("猫"), JSON.stringify(loop.getWords));

  // 4. AI coach (explain) returns structured output. Skippable + self-skips when
  // no OpenAI key is configured, so the harness stays hermetic and free to run.
  if (process.env.SKIP_AI === "1") {
    check("AI coach (skipped via SKIP_AI)", true);
  } else {
    const coach = await page.evaluate(async () => {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "explain", word: "食べる", reading: "たべる", gloss: "to eat", line: "ご飯を食べる。", level: 5 }),
      });
      return { status: res.status, body: await res.json() };
    });
    if (coach.status === 503 && coach.body?.error === "ai_not_configured") {
      check("AI coach (skipped — no OPENAI_API_KEY)", true);
    } else {
      check("AI coach explain returns meaning", coach.status === 200 && !!coach.body?.result?.meaning,
        coach.status === 200 ? "" : `status ${coach.status} ${JSON.stringify(coach.body)}`);
    }
  }

  // 5. Marketing homepage renders with no Clerk crash. Reset the error buffer so
  // this check reflects only the homepage load, matching its label.
  consoleErrors.length = 0;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const homeText = await page.locator("body").innerText();
  check("homepage renders", homeText.length > 200);
  check("no console errors on homepage", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
