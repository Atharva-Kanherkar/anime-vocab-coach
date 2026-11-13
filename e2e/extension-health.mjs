// E2E: the extension reports its own failures (src/lib/health.ts).
//
// On 2026-11-13 a store build showed romaji with no English and no N5 course,
// and nothing anywhere said so. This runs the real build against a stand-in
// animevocab.com and api.animevocab.com where translation and the course both
// fail, feeds YouTube caption lines, and checks that:
//   - the failures arrive at /api/track as `health` rows, with the reason,
//     the site, the build and the learner's token,
//   - a failure repeated on every line is still one row (dedup),
//   - the no-English watchdog fires once the Lens has shown a dozen lines,
//   - the course failure is reported from the worker,
//   - the learner is told, instead of seeing romaji and nothing else.
//
// Same harness as e2e/learning-loop.mjs: a local HTTPS server and
// --host-resolver-rules, no ctx.route(), so requests leave the extension the
// way they do in production.
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });
const VERSION = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8")).version;
const TOKEN = "avc_st_health_e2e";

const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const watchPage = (videoId) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${videoId} - YouTube</title></head><body style="background:#111;color:#eee">
<div id="movie_player" style="position:relative;width:960px;height:540px">
  <video class="html5-main-video" width="960" height="540" muted></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
</div>
<script>
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
</script></body></html>`;

const LINES = [
  "今日は本当にいい天気ですね。",
  "明日も一緒に学校へ行こうよ。",
  "これは何ですか。",
  "それは僕のピアノです。",
  "君は嘘をついていますか。",
  "春が来たら桜を見に行こう。",
  "友達と一緒に音楽を聴いた。",
  "先生はとても優しい人です。",
  "駅まで歩いて十分かかります。",
  "雨が降りそうだから傘を持って。",
  "この本はとても面白かった。",
  "日曜日に海へ行きたいな。",
  "お母さんが料理を作っている。",
  "電車の中で寝てしまった。",
  "夜空に星がたくさん見える。",
];

/** Every /api/track POST, and every other call, as the server saw them. */
const beacons = [];
const calls = [];
/** Phase 1 breaks translation and the course; phase 2 is a healthy account. */
let failing = true;

const TLS_PORT = Number(process.env.AVC_E2E_PORT || 8444);
const certDir = mkdtempSync(join(tmpdir(), "avc-e2e-health-"));
execFileSync(
  "openssl",
  [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(certDir, "key.pem"),
    "-out", join(certDir, "cert.pem"),
    "-days", "1",
    "-subj", "/CN=avc-e2e",
    "-addext", "subjectAltName=DNS:animevocab.com,DNS:api.animevocab.com,DNS:www.youtube.com",
  ],
  { stdio: "ignore" }
);

const server = createServer(
  { key: readFileSync(join(certDir, "key.pem")), cert: readFileSync(join(certDir, "cert.pem")) },
  (req, res) => {
    const host = (req.headers.host || "").split(":")[0];
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (host.endsWith("youtube.com")) {
        const id = new URL(req.url, "https://www.youtube.com").searchParams.get("v") || "unknown";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(watchPage(id));
        return;
      }
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      } catch {
        body = {};
      }
      const path = new URL(req.url, `https://${host}`).pathname;
      calls.push(`${req.method} ${host}${path}`);
      if (host === "animevocab.com" && path === "/api/track" && req.method === "POST") {
        beacons.push({ ...body, authorization: req.headers.authorization || null, origin: req.headers.origin || null });
        res.writeHead(204).end();
        return;
      }
      const json = (status, data) =>
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data));
      // The two failures from the incident, as the extension would meet them.
      if (host === "animevocab.com" && path === "/api/ai/translate") {
        return failing ? json(502, { error: "upstream_down" }) : json(200, { result: { en: "It is a fine day.", readings: {} } });
      }
      if (host === "animevocab.com" && path === "/api/ai/translate-batch") return json(failing ? 502 : 400, { error: "upstream_down" });
      // Phase 2: not enrolled is a 404, an answer, and must not be reported.
      if (host === "api.animevocab.com" && path.startsWith("/v1/n5/")) return json(failing ? 502 : 404, { error: { code: "x" } });
      // Everything else (sync, context, auth) answers like an empty account.
      return json(200, {});
    });
  }
);
await new Promise((resolve) => server.listen(TLS_PORT, "127.0.0.1", resolve));

const ctx = await chromium.launchPersistentContext("", {
  // New headless runs extensions; AVC_E2E_HEADED=1 to watch it.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  viewport: { width: 1100, height: 700 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${TLS_PORT},MAP api.animevocab.com 127.0.0.1:${TLS_PORT},MAP www.youtube.com 127.0.0.1:${TLS_PORT}`,
    "--ignore-certificate-errors",
  ],
});

const health = (name, pred = () => true) => beacons.filter((b) => b.kind === "health" && b.name === name && pred(b));
async function waitFor(pred, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  // Close the install tab (/start) so the watch page is the active one.
  await new Promise((r) => setTimeout(r, 1500));
  for (const p of ctx.pages()) if (!p.url().startsWith("about:")) await p.close().catch(() => {});

  await sw.evaluate(
    (token) =>
      chrome.storage.local.set({
        syncToken: token,
        syncProfile: { email: "e2e@example.com", name: "E2E", plan: "free" },
        settings: {
          pauseMode: "off",
          subLens: true,
          subLensPeek: false,
          learningDirection: "en-ja",
          targetLevel: 5,
          displayScript: "romaji",
        },
        vocab: {},
        stats: { daily: {}, cardTimestamps: [] },
        onboarding: { installedAt: 1, checklistDismissedAt: 1 },
      }),
    TOKEN
  );

  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=healthA", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("video"), null, { timeout: 10000 });
  await page.waitForTimeout(6000); // kuromoji + dictionary load

  const lensText = () =>
    page.evaluate(() => document.querySelector("[data-avc-sub-lens]")?.shadowRoot?.querySelector(".line.jp")?.textContent || "");
  const shadowText = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((e) => e.shadowRoot)
        .map((e) => e.shadowRoot.textContent || "")
        .join(" | ")
    );

  let shown = 0;
  let toldText = "";
  for (const line of LINES) {
    await page.evaluate((l) => window.avcCaption(l), line);
    await page.waitForTimeout(1300);
    if (await lensText()) shown++;
    // Toasts dismiss themselves, so look while the lines are playing.
    if (!toldText) {
      const all = await shadowText();
      const m = all.match(/English subtitles aren't loading right now[^|]*/);
      if (m) toldText = m[0];
    }
    await page.evaluate(() => window.avcCaption(""));
    await page.waitForTimeout(300);
  }
  check("the Lens showed the lines (romaji works, the precondition)", shown >= 12, `${shown}/${LINES.length}`);

  check(
    "a failed translation is reported as subs_english_failed with the server's reason",
    await waitFor(() => health("subs_english_failed", (b) => b.code === "upstream_down").length > 0),
    JSON.stringify(health("subs_english_failed"))
  );
  const failed = health("subs_english_failed", (b) => b.code === "upstream_down");
  check("it names the site and the build", failed.every((b) => b.surface === "youtube" && b.v === VERSION), JSON.stringify(failed));
  check(
    "it carries the learner's token, so the row has a userId",
    failed.every((b) => b.authorization === `Bearer ${TOKEN}`)
  );
  check(
    "it is sent with the extension's privileges, not the page's",
    failed.every((b) => String(b.origin).startsWith("chrome-extension://")),
    JSON.stringify(failed.map((b) => b.origin))
  );
  check("the same failure on every line is still one row", failed.length === 1, `${failed.length} rows`);

  check(
    "the watchdog reports a video with no English at all, with what it knows",
    await waitFor(() => health("subs_english_missing").length > 0),
    JSON.stringify(health("subs_english_missing"))
  );
  check(
    "the watchdog's reason says where lines came from and why English is missing",
    health("subs_english_missing").some((b) => b.code === "page_none_upstream_down"),
    JSON.stringify(health("subs_english_missing").map((b) => b.code))
  );

  check(
    "a course that will not load is reported from the worker",
    await waitFor(() => health("course_load_failed", (b) => b.code === "course_502" && b.surface === "worker").length > 0),
    JSON.stringify(health("course_load_failed"))
  );

  check("the learner is told English is not loading, instead of seeing nothing", !!toldText, toldText.slice(0, 120));

  check(
    "no health row is sent with a name or reason outside the allowlist's shape",
    beacons
      .filter((b) => b.kind === "health")
      .every((b) => ["subs_english_failed", "subs_english_missing", "course_load_failed", "bg_unreachable"].includes(b.name) && /^[a-z0-9_.:-]{1,48}$/.test(b.code)),
    JSON.stringify(beacons.filter((b) => b.kind === "health"))
  );

  const outbox = await sw.evaluate(async () => (await chrome.storage.local.get("healthOutbox")).healthOutbox ?? []);
  check("the outbox is empty once the server has taken the rows", Array.isArray(outbox) && outbox.length === 0, JSON.stringify(outbox));

  await page.screenshot({ path: `${SHOTS}/extension-health.png` });

  // ── Control: a healthy learner makes no noise ─────────────────────────────
  // English works and the account has no course (404). Every row from here on
  // would be a false alarm on the dashboard.
  failing = false;
  await sw.evaluate(() => chrome.storage.local.remove(["healthSent", "n5Listen"]));
  const mark = beacons.length;
  await page.goto("https://www.youtube.com/watch?v=healthB", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("video"), null, { timeout: 10000 });
  await page.waitForTimeout(6000);
  let english = 0;
  for (const line of LINES) {
    await page.evaluate((l) => window.avcCaption(l), line);
    await page.waitForTimeout(1300);
    const en = await page.evaluate(
      () => document.querySelector("[data-avc-sub-lens]")?.shadowRoot?.querySelector(".line.en")?.textContent || ""
    );
    if (en) english++;
    await page.evaluate(() => window.avcCaption(""));
    await page.waitForTimeout(300);
  }
  await new Promise((r) => setTimeout(r, 2000));
  check("control: English shows when translation works", english >= 10, `${english}/${LINES.length}`);
  const noise = beacons.slice(mark).filter((b) => b.kind === "health");
  check("control: a healthy learner with no course sends no health rows", noise.length === 0, JSON.stringify(noise));
} finally {
  await ctx.close();
  server.close();
}

const failedCount = results.filter((r) => !r).length;
console.log(`\n${results.length - failedCount}/${results.length} passed`);
process.exit(failedCount ? 1 : 0);
