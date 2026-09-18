// Two paths youtube-session.mjs does not reach, both of them the second half of
// a fix it already covers:
//
//   A. #127 holds the card through a pause. This asks what happens to the pause
//      itself when the learner acts on the card they paused for.
//   B. #125 drops the *queued* line on a video change. This covers the line that
//      was already past that gate — still awaiting its target pick — when the
//      playlist advanced.
//
// Both need a clean session and a realistic target-pick latency, which is why
// they live here rather than at the end of the main suite: once a line's words
// are known the pick short-circuits before its round-trip, and the window B
// probes stops existing.
//
// Screenshots land in e2e/shots when AVC_SHOTS is set.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
const TAG = process.env.AVC_TAG || "run";
if (process.env.AVC_SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok, d });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const watchPage = (videoId) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${videoId} - YouTube</title></head><body style="background:#0f0f0f;color:#f1f1f1;font:14px system-ui;margin:0">
<div id="movie_player" style="padding:12px">
  <div style="font:600 15px system-ui;padding:6px 2px">PR #134 review harness — <span id="vid">${videoId}</span></div>
  <video class="html5-main-video" width="640" muted></video>
  <div class="ytp-caption-window-container" style="padding:8px 2px;font:600 18px system-ui">
    <span class="ytp-caption-segment"></span>
  </div>
  <div id="probe" style="padding:6px 2px;font:600 14px ui-monospace;color:#7ee787"></div>
</div>
<script>
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#1b2b44"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
  window.avcProbe = (t) => { document.getElementById("probe").textContent = t; };
  window.avcNavigate = (id) => {
    history.pushState({}, "", "/watch?v=" + id);
    document.title = id + " - YouTube";
    document.getElementById("vid").textContent = id;
    window.dispatchEvent(new Event("yt-navigate-finish"));
  };
</script></body></html>`;

const CARD = "#avc-overlay-host .avc-agent-word-block.avc-active";
const BTN = "#avc-overlay-host .avc-agent-foot.avc-active button";
const LINES = ["父はまだ帰らない。", "約束を守ると言った。", "電車が遅れている。", "彼女は静かに笑った。", "時間がもうない。"];

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

const shot = async (page, name) => {
  if (!process.env.AVC_SHOTS) return;
  const f = `${SHOTS}/${TAG}-${name}.png`;
  await page.screenshot({ path: f });
  console.log(`      shot: ${f}`);
};

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const SETTINGS = {
    pauseMode: "copilot", cooldownSec: 0, maxCardsPerHour: 99, autoResumeSec: 3,
    autoSpeak: false, subLens: false, targetLevel: 5, learningDirection: "en-ja",
  };

  async function seedSettings() {
    for (let i = 0; i < 12; i++) {
      await sw.evaluate((s) => chrome.storage.local.set({
        settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] },
        syncToken: "e2e-review-token",
      }), SETTINGS);
      await new Promise((r) => setTimeout(r, 250));
      const got = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
      if (got?.autoResumeSec === 3 && got.cooldownSec === 0 && got.subLens === false) return got;
    }
    return null;
  }

  // In production the target pick is an authenticated AI call. Unlinked, it
  // returns `not_linked` instantly and the line is processed in about a
  // millisecond, which hides every await in the pipeline. Link the account and
  // give the pick a realistic latency so the line is genuinely in flight.
  const PICK_MS = 1200;
  await ctx.route("https://animevocab.com/api/ai/pick-word", async (route) => {
    await new Promise((r) => setTimeout(r, PICK_MS));
    const body = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ result: { word: body.candidates?.[0]?.word || "" } }),
    });
  });

  await ctx.route("https://www.youtube.com/**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("v") || "unknown";
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage(id) });
  });

  const page = await ctx.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (process.env.AVC_VERBOSE && t.includes("[AVC]")) console.log("   [page]", t.slice(0, 180));
  });
  await page.goto("https://www.youtube.com/watch?v=reviewA", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
  await page.waitForTimeout(6000);
  check("harness: settings seeded", !!(await seedSettings()));

  async function cardOnScreen(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let i = 0;
    while (Date.now() < deadline) {
      await page.evaluate((l) => window.avcCaption(l), LINES[i++ % LINES.length]);
      try { await page.waitForSelector(CARD, { timeout: 4000, state: "attached" }); return true; }
      catch { /* next line */ }
    }
    return false;
  }

  // ── A. Pause to study, then grade the card ───────────────────────────────
  // #127's whole premise is that a learner pauses the video to study the line.
  // The card now holds. The question this asks is what happens to the learner's
  // pause when they act on the card they paused for.
  check("A: a line raises a card on a playing video", await cardOnScreen());
  await page.evaluate(() => { document.querySelector("video").pause(); window.avcProbe("learner paused the video"); });
  await page.waitForTimeout(1200);
  const heldWhilePaused = (await page.locator(CARD).count()) > 0;
  check("A: the card holds while paused (the #127 fix)", heldWhilePaused);
  await page.evaluate(() => window.avcProbe("paused + card held — now clicking a judgment button"));
  await shot(page, "A1-card-held-while-paused");

  const btnLabel = await page.locator(BTN).first().innerText().catch(() => "?");
  await page.locator(BTN).first().click();
  await page.waitForTimeout(1200);
  const stillPaused = await page.evaluate(() => document.querySelector("video").paused);
  await page.evaluate((p) => window.avcProbe(
    p ? "video still paused after grading — correct" : "VIDEO RESUMED ITSELF after grading — the learner's pause was overridden"
  ), stillPaused);
  await shot(page, "A2-after-grading-while-paused");
  check(
    `A: grading a card on a learner-paused video leaves the video paused (clicked ${JSON.stringify(btnLabel)})`,
    stillPaused,
    stillPaused ? "" : "the extension called play() on a video the learner deliberately paused"
  );

  // ── B. A line still in flight when the playlist advances ─────────────────
  // processLine awaits tokenisation, storage and a target pick before it opens
  // a card. The session reset drops `queuedLine`, but a line already past that
  // gate keeps going and cards against whatever video is on screen when it
  // lands.
  await page.evaluate(() => document.querySelector("video").play().catch(() => {}));
  await page.waitForTimeout(1500);
  // Clear any card left standing before the probe.
  await page.evaluate(() => window.avcCaption(""));
  await page.waitForTimeout(4000);

  let leaked = null;
  let probed = 0;
  for (let attempt = 0; attempt < 10 && !leaked; attempt++) {
    const line = LINES[attempt % LINES.length];
    const from = `leakA${attempt}`, to = `leakB${attempt}`;
    await page.evaluate(() => window.avcCaption(""));
    await page.waitForTimeout(1200);
    await page.evaluate((id) => window.avcNavigate(id), from);
    await page.waitForTimeout(2600); // let the session watcher settle on `from`
    if ((await page.locator(CARD).count()) > 0) continue; // a card left standing

    await page.evaluate(([l]) => { window.avcCaption(l); window.avcProbe("line fed on " + location.search); }, [line]);
    // Navigate while the line is between the caption node and the card. Too
    // early and nothing is in flight; too late and the card has legitimately
    // opened on the old video, which is not what this is testing.
    await page.waitForTimeout(250 + attempt * 150); // inside the pick's latency
    if ((await page.locator(CARD).count()) > 0) continue; // the card beat us; retry sooner
    probed++;
    await page.evaluate((id) => { window.avcNavigate(id); window.avcProbe("advanced to " + id + " while the line was still processing"); }, to);

    // From here, the only line in flight is the one spoken on the old video.
    for (let w = 0; w < 14; w++) {
      await page.waitForTimeout(250);
      if ((await page.locator(CARD).count()) > 0) {
        const word = await page.locator(`${CARD} .avc-agent-word`).first().innerText().catch(() => "?");
        leaked = { word, line, to };
        break;
      }
    }
    // Shoot the first clean probe, and any leak, at the moment it is decided —
    // not at the end of the loop, where a later card would muddy the picture.
    if (probed === 1 || leaked) {
      await page.evaluate((d) => window.avcProbe(
        d.word
          ? `CARD FROM THE PREVIOUS VIDEO: "${d.word}" (from "${d.line}") is showing on ${d.to}`
          : `"${d.line}" was spoken on ${d.from}; advanced to ${d.to} mid-flight — no card leaked`
      ), leaked || { line, from, to, word: "" });
      await shot(page, "B1-advance-while-line-in-flight");
    }
  }
  check("B: the probe caught the line mid-flight at least once", probed > 0, `${probed} probe(s)`);
  check(
    "B: a line in flight when the video changes does not card on the new video",
    !leaked,
    leaked ? `card "${leaked.word}" from "${leaked.line}" appeared on ${leaked.to}` : `${probed} probe(s), none leaked`
  );
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
