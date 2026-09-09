// Headed E2E for issues #130 and #131: this extension must never undo a pause
// the learner owns, and a peek-pause must not outlive the page's focus.
//
// Netflix is not driven (account, licensed stream, and a DOM that is not ours
// to depend on). The served-watch-page harness gives a real content script a
// canvas-backed video whose play/pause/seek fire real events, which is what the
// code under test actually listens to.
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const watchPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>hold - YouTube</title>
<style>html,body{margin:0;height:100%;background:#111}#movie_player{position:relative;width:100vw;height:100vh}</style>
</head><body>
<div id="movie_player">
  <video class="html5-main-video" width="640" muted></video>
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
  window.avcPaused = () => v.paused;
  // A MediaStream has no seekable timeline, so a seek is dispatched directly.
  // The code under test listens for the events, not for a position change.
  window.avcSeekWhilePaused = () => {
    v.dispatchEvent(new Event("seeking"));
    v.dispatchEvent(new Event("seeked"));
  };
  window.avcLearnerPause = () => v.pause();
  window.avcLearnerPlay = () => v.play().catch(() => {});
</script></body></html>`;

const LINES = ["父はまだ帰らない。", "約束を守ると言った。"];

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  await ctx.route("https://www.youtube.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage })
  );

  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=playbackHold", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });

  // Subtitle Lens on with peek-pause, automatic cards off so only the lens
  // touches playback in this run.
  const SETTINGS = {
    pauseMode: "off",
    cooldownSec: 0,
    maxCardsPerHour: 99,
    autoResumeSec: 15,
    autoSpeak: false,
    subLens: true,
    subLensPeek: true,
    targetLevel: 5,
    learningDirection: "en-ja",
  };
  let applied = false;
  for (let i = 0; i < 12 && !applied; i++) {
    await sw.evaluate((s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }), SETTINGS);
    await page.waitForTimeout(250);
    applied = await sw.evaluate(
      async () => (await chrome.storage.local.get("settings")).settings?.subLensPeek === true
    );
  }
  check("test settings applied", applied);
  await page.waitForTimeout(5000);

  // Raise the lens by feeding a subtitle line.
  let lensUp = false;
  for (let i = 0; i < 8 && !lensUp; i++) {
    await page.evaluate((l) => window.avcCaption(l), LINES[i % LINES.length]);
    lensUp = await page
      .waitForFunction(
        () => !!document.querySelector("[data-avc-sub-lens]")?.shadowRoot?.querySelector(".tok"),
        null,
        { timeout: 3000 }
      )
      .then(() => true)
      .catch(() => false);
  }
  check("the subtitle lens is showing hoverable words", lensUp);

  const paused = () => page.evaluate(() => window.avcPaused());
  // peek-pause is armed by mouseenter on the lens itself (see ensureMounted in
  // sub-lens.ts), which is what a learner triggers by moving onto the line.
  const hoverWord = () =>
    page.evaluate(() => {
      const lens = document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".lens");
      lens.dispatchEvent(new MouseEvent("mouseenter"));
    });
  const unhoverWord = () =>
    page.evaluate(() => {
      const lens = document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".lens");
      lens.dispatchEvent(new MouseEvent("mouseleave"));
    });

  // ── The feature still works ───────────────────────────────────────────────
  await hoverWord();
  await page.waitForTimeout(600);
  const pausedOnHover = await paused();
  check("peek-pause still pauses while a word popup is open", pausedOnHover);
  await unhoverWord();
  await page.waitForTimeout(1200);
  check("peek-pause still resumes when the pointer leaves", !(await paused()));

  // ── #130: a learner pause plus a seek must survive ───────────────────────
  await hoverWord();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.avcLearnerPause()); // they hit space
  await page.evaluate(() => window.avcSeekWhilePaused()); // they click the timeline
  await unhoverWord();
  await page.waitForTimeout(1500); // past POINTER_LEAVE_DELAY + RESUME_DELAY
  check("#130 a pause the learner owns is not undone by the lens", await paused());

  // Clean slate for the next case.
  await page.evaluate(() => window.avcLearnerPlay());
  await page.waitForTimeout(500);

  // ── #131: focus loss must not park the video ─────────────────────────────
  await hoverWord();
  await page.waitForTimeout(500);
  check("armed a peek-pause before taking focus away", await paused());
  // Opening the toolbar popup takes focus with the pointer outside the
  // document, so the pointer-leave path never runs.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const resumed = await page
    .waitForFunction(() => !window.avcPaused(), null, { timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  check("#131 losing focus gives the pause back instead of parking it", resumed, `paused=${await paused()}`);

  // And the same when the tab is genuinely hidden. Faking document.hidden from
  // the page does not work: expandos set in the page world are invisible to a
  // content script's isolated world, so the handler would never see it. Another
  // tab in front is the real thing.
  await hoverWord();
  await page.waitForTimeout(500);
  check("armed a peek-pause before hiding the tab", await paused());
  // Another tab in front does not reliably flip visibility in a persistent
  // context, so ask the browser directly.
  const cdp = await ctx.newCDPSession(page);
  let hiddenForReal = true;
  try {
    await cdp.send("Emulation.setPageVisibilityOverride", { visible: false });
  } catch {
    hiddenForReal = false;
  }
  // waitForFunction polls with requestAnimationFrame, which a hidden tab does
  // not run: evaluate directly after giving the handler a beat.
  await new Promise((r) => setTimeout(r, 2000));
  const pausedWhileHidden = await paused();
  if (hiddenForReal) {
    check("#131 a hidden tab does the same", !pausedWhileHidden, `paused=${pausedWhileHidden}`);
  } else {
    console.log("SKIP  #131 hidden-tab case — this browser would not override page visibility");
  }
  try {
    await cdp.send("Emulation.setPageVisibilityOverride", { visible: true });
  } catch {}
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
