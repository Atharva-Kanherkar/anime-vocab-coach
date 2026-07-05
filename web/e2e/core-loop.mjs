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
  check("dashboard greets dev user", appText.includes("hey, dev learner"));
  check("dashboard shows due-today tile", appText.includes("due today"));

  // 2. Connection banner minted + broadcast a token in-browser.
  await page.waitForFunction(
    () => document.body.innerText.includes("Extension connected") ||
          document.body.innerText.includes("Extension not linked"),
    { timeout: 10000 }
  );
  const linked = (await page.locator("body").innerText()).includes("Extension connected");
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
          vocab: { "猫": { state: "learning", reading: "ねこ", gloss: "cat", level: 5, freqRank: 900, seenCount: 3, shownCount: 1, firstSeenAt: 1704067200000, lastSeenAt: 1704067200000, srs: { stage: 2, dueAt: 1704153600000, lapses: 0 }, source: { title: "Spirited Away", line: "猫が好き", en: "I like cats" } } },
          stats: { daily: { "2026-07-05": { met: 1, judged: 1, reviews: 0, watchMin: 12 } }, cardTimestamps: [1704067200000] },
        },
        expectedRevision,
      }),
    });
    const get = await fetch("/api/sync/snapshot", { headers: { Authorization: "Bearer " + token } });
    const getBody = await get.json();
    const words = getBody.envelope?.snapshot?.words || [];
    const cat = words.find((w) => w.base === "猫");
    return { hasToken: !!token, putStatus: put.status, getWords: words.map((w) => w.base), catSourceTitle: cat?.source?.title ?? null };
  });
  check("token minted", loop.hasToken);
  check("snapshot PUT ok", loop.putStatus === 200, `status ${loop.putStatus}`);
  check("snapshot round-trips the word", loop.getWords.includes("猫"), JSON.stringify(loop.getWords));
  check("word capture context (source) survives sync", loop.catSourceTitle === "Spirited Away", `title ${loop.catSourceTitle}`);

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

      // The overlay card calls the coach via the extension's sync-token bearer
      // (routed through the background). Prove that auth path works.
      const bearer = await page.evaluate(async () => {
        const t = await (await fetch("/api/sync/token", { method: "POST" })).json();
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + t.token },
          body: JSON.stringify({ mode: "explain", word: "見る", reading: "みる", gloss: "to see", line: "星を見る。", level: 5, title: "Your Name" }),
        });
        return { tokenOk: typeof t.token === "string" && t.token.startsWith("avc_st_"), status: res.status, hasMeaning: !!(await res.json())?.result?.meaning };
      });
      // tokenOk guards against a false pass where a missing token → "Bearer undefined"
      // falls through to cookie/dev auth instead of exercising the bearer path.
      check("coach accepts extension sync-token bearer", bearer.tokenOk && bearer.status === 200 && bearer.hasMeaning, `token ${bearer.tokenOk} status ${bearer.status}`);
    }
  }

  // 4b. Notebooks CRUD (issue #14) — create → add entry → list → delete. No AI
  // (that path is metered/costly and covered separately), so this stays hermetic.
  const nbFlow = await page.evaluate(async () => {
    const created = await (await fetch("/api/notebooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E Notebook" }),
    })).json();
    const id = created.notebook?.id;
    const added = await (await fetch(`/api/notebooks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "addEntry", entry: { kind: "word", word: "約束", gloss: "promise" } }),
    })).json();
    const list = await (await fetch("/api/notebooks")).json();
    const found = (list.notebooks || []).find((n) => n.id === id);
    const del = await fetch(`/api/notebooks/${id}`, { method: "DELETE" });
    return { id, entryCount: added.notebook?.entries?.length, listedCount: found?.entryCount, delStatus: del.status };
  });
  check("notebook created", !!nbFlow.id);
  check("notebook entry added", nbFlow.entryCount === 1, `entries ${nbFlow.entryCount}`);
  check("notebook shows in list with count", nbFlow.listedCount === 1, `listed ${nbFlow.listedCount}`);
  check("notebook deleted", nbFlow.delStatus === 200, `status ${nbFlow.delStatus}`);

  // NotebooksPanel renders on /app (Notebooks tab).
  await page.goto(`${BASE}/app`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Notebooks" }).click();
  check("notebooks panel renders on /app",
    (await page.locator("body").innerText()).toLowerCase().includes("notebooks"));

  // Anki/CSV export lives under Sync → Advanced (the synced 猫 is a "learning" card → count >= 1).
  await page.getByRole("tab", { name: "Sync" }).click();
  await page.locator("details.sync-advanced summary").click();
  check("Anki export button renders on /app",
    (await page.locator("body").innerText()).includes("Export for Anki"));

  // 4c. Gamification (issue #17): opt in, sync activity → server-computed
  // leaderboard entry + rank; prefs round-trip. Deterministic regardless of
  // prior dev-store state because we set prefs first.
  const gam = await page.evaluate(async (today) => {
    await fetch("/api/leaderboard/prefs", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "E2E Learner", optOut: false }),
    });
    const rev = (await (await fetch("/api/sync/snapshot")).json()).envelope?.revision ?? null;
    await fetch("/api/sync/snapshot", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        export: { exportedAt: `${today}T00:00:00.000Z`, settings: {}, vocab: {},
          stats: { daily: { [today]: { met: 2, judged: 7, reviews: 7, watchMin: 15 } }, cardTimestamps: [] } },
        expectedRevision: rev,
      }),
    });
    const board = await (await fetch("/api/leaderboard")).json();
    return { count: board.entries?.length ?? 0, meRank: board.me?.rank ?? null, meReviewed: board.me?.wordsReviewed ?? null };
  }, new Date().toISOString().slice(0, 10));
  check("leaderboard has an entry after opt-in sync", gam.count >= 1, `count ${gam.count}`);
  check("caller has a leaderboard rank", gam.meRank === 1, `rank ${gam.meRank}`);
  check("leaderboard reflects server-computed reviews", gam.meReviewed === 7, `reviewed ${gam.meReviewed}`);
  await page.getByRole("tab", { name: "Progress" }).click();
  check("progress panel renders on /app",
    (await page.locator("body").innerText()).toLowerCase().includes("leaderboard"));

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
