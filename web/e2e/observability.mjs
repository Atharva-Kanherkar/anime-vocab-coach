// E2E for the web half of #111 / #112 / #113, driven by Playwright against a
// real `next dev`.
//
// It starts the dev server itself (dev Clerk bypass on) with one thing faked:
// Cloudflare's Analytics Engine SQL API, intercepted at the undici layer by
// e2e/support/mock-cloudflare.mjs. Without that, /owner has no credentials,
// renders its "not configured" state, and the panels this PR changed never
// appear — so the fake is what makes the render assertable at all. Everything
// else (the routes, KV's dev fallback, the page itself) is the real thing.
//
//   node web/e2e/observability.mjs
//   BASE=http://localhost:3401 node web/e2e/observability.mjs   (reuse a server)
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

const PORT = Number(process.env.PORT || 3401);
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
const ctx = await browser.newContext();
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // ── /owner renders the panels this PR changed ─────────────────────────────
  const res = await page.goto(`${BASE}/owner?h=24`, { waitUntil: "networkidle" });
  check("/owner renders", res?.status() === 200, `HTTP ${res?.status()}`);

  const body = await page.locator("body").innerText();
  check(
    "it is the configured dashboard, not the setup screen",
    !body.includes("analytics token") || body.includes("LLM calls"),
    body.slice(0, 200)
  );

  /** The value + foot line of a stat tile, by its label. */
  const stat = async (label) => {
    const tile = page.locator(".ow-stat").filter({ hasText: label }).first();
    if ((await tile.count()) === 0) return null;
    return {
      value: (await tile.locator(".ow-stat-value").innerText()).trim(),
      foot: (await tile.locator(".ow-stat-foot").innerText().catch(() => "")).trim(),
    };
  };

  // #113 — three caches, three panels. The single mislabelled one is gone.
  check(
    "the old single 'Response cache' tile is gone",
    !(await page.locator(".ow-stat-label", { hasText: /^Response cache$/ }).count()),
  );

  const coach = await stat("Coach response cache");
  check("Coach response cache tile exists", !!coach, JSON.stringify(coach));
  // 100 cached of 408 calls = 24.5% → rendered to the nearest point.
  check("and reads the cached-reply share", coach?.value === "25%", JSON.stringify(coach));

  const prompt = await stat("LLM prompt cache");
  check("LLM prompt cache tile exists", !!prompt, JSON.stringify(prompt));
  // 400k cached input tokens of 1M.
  check("and reads the cached-input-token share", prompt?.value === "40%", JSON.stringify(prompt));
  check(
    "with the token counts behind it",
    prompt?.foot.includes("400,000") && prompt?.foot.includes("1,000,000"),
    JSON.stringify(prompt)
  );

  const ctxCache = await stat("Anime-context cache");
  check("Anime-context cache tile exists", !!ctxCache, JSON.stringify(ctxCache));
  // 17 hits / 83 misses — the number that was invisible before this PR.
  check("and reads the real hit rate over real lookups", ctxCache?.value === "17%", JSON.stringify(ctxCache));
  check(
    "naming the paid lookups that are its denominator",
    ctxCache?.foot.includes("17 hits") && ctxCache?.foot.includes("83 paid lookups"),
    JSON.stringify(ctxCache)
  );

  check(
    "the three cache tiles report three different numbers",
    new Set([coach?.value, prompt?.value, ctxCache?.value]).size === 3,
    JSON.stringify([coach?.value, prompt?.value, ctxCache?.value])
  );

  // #113 — the distinct-user count the LLM tile used to render as 0.
  const llm = await stat("LLM calls");
  check("LLM calls reports a real distinct-user count", llm?.foot.startsWith("10 distinct users"), JSON.stringify(llm));

  // #111 — the learning-loop panel.
  const loop = page.locator(".ow-panel").filter({ hasText: "Learning loop" }).first();
  check("the Learning loop panel exists", (await loop.count()) === 1);
  const loopRows = await loop.locator("tbody tr").allInnerTexts();
  check(
    "it lists the learning-loop events",
    ["card_shown", "card_learn", "word_saved", "review_done", "streak_day", "card_unlocked"].every((n) =>
      loopRows.some((r) => r.includes(n))
    ),
    JSON.stringify(loopRows.map((r) => r.split("\t")[0]))
  );
  check(
    "and nothing else — acquisition events and the cache probe stay out",
    !loopRows.some((r) => /anime_context|landing_view|store_cta_click/.test(r)),
    JSON.stringify(loopRows.map((r) => r.split("\t")[0]))
  );
  const cardShownRow = loopRows.find((r) => r.startsWith("card_shown"));
  check(
    "card_shown reports 412 events across 8 identified learners",
    /412/.test(cardShownRow || "") && /\b8\b/.test(cardShownRow || ""),
    JSON.stringify(cardShownRow)
  );
  check(
    "the anonymous bucket is shown separately, not counted as a learner",
    /140/.test(cardShownRow || ""),
    JSON.stringify(cardShownRow)
  );
  // 412 events, 140 of them anonymous, over 8 identified learners: 272/8 = 34.0.
  // Dividing the total instead would read 51.5 and charge anonymous installs
  // to the learners who happen to be linked.
  check(
    "per learner divides identified events, not the total",
    /34\.0/.test(cardShownRow || ""),
    JSON.stringify(cardShownRow)
  );
  const installRow = loopRows.find((r) => r.startsWith("install_first_run"));
  check(
    "an entirely anonymous event reports no learners and no rate",
    /—/.test(installRow || ""),
    JSON.stringify(installRow)
  );

  // #160: the API errors breakdown under API routes.
  const panelTitled = (title) =>
    page.locator(".ow-panel", { has: page.locator("h2", { hasText: new RegExp(`^${title}$`) }) });
  const apiErrors = panelTitled("API errors");
  check("the API errors panel exists", (await apiErrors.count()) === 1);
  const errRows = (await apiErrors.locator("tbody tr").allInnerTexts()).map((r) => r.split("\t"));
  const deadLink = errRows.find((c) => c[0] === "/api/anime/context" && c[1]?.startsWith("401"));
  check(
    "the extension's 401s are their own row, read as unauthorized",
    deadLink?.[1] === "401 unauthorized" && deadLink?.[3] === "sync_token" && deadLink?.[4] === "250",
    JSON.stringify(deadLink)
  );
  check("rows from before the reason existed say so", deadLink?.[2] === "not recorded", JSON.stringify(deadLink));
  check("an all-anonymous 401 reports no learners", deadLink?.[5] === "0", JSON.stringify(deadLink));
  const kvRow = errRows.find((c) => c[1]?.startsWith("502"));
  check(
    "a 502 carries its KV reason, not an OpenAI one",
    kvRow?.[1] === "502 upstream failed" && kvRow?.[2] === "kv_get_failed:_429_too_many_requests",
    JSON.stringify(kvRow)
  );
  const capRow = errRows.find((c) => c[0] === "/api/ai/pick-word");
  check(
    "an auto-cap 429 is visible with its reason",
    capRow?.[1] === "429 quota or rate limit" && capRow?.[2] === "auto_quota_exhausted",
    JSON.stringify(capRow)
  );
  const routeRow = (await panelTitled("API routes").locator("tbody tr").allInnerTexts())
    .map((r) => r.split("\t"))
    .find((c) => c[0] === "/api/anime/context");
  check(
    "the anime-context error rows sum to its 4xx/5xx cell (250 + 45 = 295)",
    routeRow?.[3] === "295",
    JSON.stringify(routeRow)
  );

  await page.screenshot({ path: join(SHOTS, "owner-observability.png"), fullPage: true });
  await apiErrors.screenshot({ path: join(SHOTS, "owner-api-errors.png") });

  // One learner's view says what it cannot show: a dead link's 401 has no user.
  await page.goto(`${BASE}/owner?h=24&user=user_42`, { waitUntil: "networkidle" });
  const drillCaption = await panelTitled("API errors").locator(".ow-sub").innerText().catch(() => "");
  check(
    "the single-user API errors panel explains the missing 401s",
    drillCaption.includes("This learner's failures only"),
    JSON.stringify(drillCaption)
  );
  check("no console errors on /owner", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  // ── the routes the extension actually calls ───────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });

  const token = await page.evaluate(async () => {
    const r = await fetch("/api/sync/token", { method: "POST" });
    return (await r.json()).token;
  });
  check("a sync token can be minted", typeof token === "string" && token.startsWith("avc_st_"), String(token));

  // #112 — the beacon now resolves identity from that bearer before writing.
  // It must still answer 204, and still answer fast: this is the hot path the
  // extension hits once per card.
  const beacon = await page.evaluate(async (t) => {
    const started = performance.now();
    const r = await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${t}` },
      body: JSON.stringify({ kind: "feature", name: "card_shown" }),
    });
    return { status: r.status, ms: Math.round(performance.now() - started) };
  }, token);
  check("a sync-token-authed learning-loop beacon is accepted", beacon.status === 204, JSON.stringify(beacon));
  check("and the identity lookup does not slow the beacon down", beacon.ms < 1500, `${beacon.ms}ms`);

  const anon = await page.evaluate(async () => {
    const r = await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "feature", name: "card_shown" }),
    });
    return r.status;
  });
  check("an unlinked install's beacon is still accepted", anon === 204, String(anon));

  const junk = await page.evaluate(async () => {
    const r = await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "feature", name: "arbitrary_string" }),
    });
    return r.status;
  });
  check("an unknown event name is refused silently, not with an error", junk === 204, String(junk));

  // #111 — streak_day / card_unlocked are derived on this route. Two pushes in
  // a row is the case that must not fail: the second one diffs against the
  // first, which is the code path this PR added.
  const sync = await page.evaluate(async (t) => {
    const auth = { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    const day = new Date().toISOString().slice(0, 10);
    const push = async (judged, expectedRevision) => {
      const r = await fetch("/api/sync/snapshot", {
        method: "PUT",
        headers: auth,
        body: JSON.stringify({
          expectedRevision,
          export: {
            source: "animevocab-extension",
            exportedAt: new Date().toISOString(),
            settings: {},
            vocab: { 約束: { state: "learning", reading: "やくそく", gloss: "promise", level: 4, freqRank: 500, seenCount: 1, shownCount: 1, firstSeenAt: Date.now(), lastSeenAt: Date.now(), srs: { stage: 1, dueAt: Date.now(), lapses: 0 } } },
            stats: { daily: { [day]: { met: 1, judged, reviews: judged, watchMin: 5 } }, cardTimestamps: [] },
          },
        }),
      });
      return { status: r.status, revision: (await r.json()).envelope?.revision ?? null };
    };
    // Read the current revision first, exactly as the extension does. /app may
    // already have written a snapshot by now, and pushing with a null expected
    // revision against an existing envelope is a legitimate 409 — a race in
    // this harness, not a fault in the route.
    const cur = await fetch("/api/sync/snapshot", { headers: auth }).then((r) => r.json());
    const first = await push(1, cur.envelope?.revision ?? null);
    const second = await push(4, first.revision);
    return { first, second };
  }, token);
  check("a first snapshot push succeeds", sync.first.status === 200, JSON.stringify(sync.first));
  check(
    "and a second push against it succeeds too (the derived-event diff runs)",
    sync.second.status === 200 && sync.second.revision > sync.first.revision,
    JSON.stringify(sync)
  );
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
