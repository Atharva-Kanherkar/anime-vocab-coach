// Headed E2E for the 2026-09-09 YouTube QA round: issues #125, #126, #127, #128.
//
// youtube.com is served from this script instead of the network: playwright
// fulfills the request with a page that looks enough like a watch page for the
// real content script (it only loads on youtube.com/netflix.com/crunchyroll.com)
// to run its actual pipeline against a canvas-backed <video>. Nothing here
// mocks the extension; the cards, the panel and the toasts are the shipped ones.
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

/** A watch page: YouTube's player container, caption node, and a live video. */
const watchPage = (videoId) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${videoId} - YouTube</title></head><body style="background:#111;color:#eee">
<div id="movie_player">
  <video class="html5-main-video" width="640" muted></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
</div>
<script>
  const v = document.querySelector("video");
  // A canvas stream gives a genuinely playing video with no codec or network:
  // play()/pause() fire real events, which is what the card timer listens to.
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
  window.__events = [];
  ["play", "pause", "playing"].forEach((n) =>
    v.addEventListener(n, () => window.__events.push(n + "@" + (Date.now() % 100000)))
  );
  window.avcNavigate = (id) => {
    history.pushState({}, "", "/watch?v=" + id);
    document.title = id + " - YouTube";
    window.dispatchEvent(new Event("yt-navigate-finish"));
  };
  // Stands in for youtube-main.js reading the player response, which needs the
  // real player: the caption-track list the adapter reacts to.
  window.avcTracks = (tracks) => window.postMessage(
    { source: "avc", type: "avc-caption-tracks", videoId: new URLSearchParams(location.search).get("v"), tracks },
    "*"
  );
</script></body></html>`;

const CARD = "#avc-overlay-host .avc-agent-word-block.avc-active";
const TOAST = "#avc-overlay-host #avc-toast-layer div";
const LINES = ["父はまだ帰らない。", "約束を守ると言った。", "電車が遅れている。"];

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));

  // Ambient cards, a short dismissal clock so the pause test does not idle for
  // 15s, no cooldown, and the Lens off so only the automatic card is in play.
  const SETTINGS = {
    pauseMode: "copilot",
    cooldownSec: 0,
    maxCardsPerHour: 99,
    autoResumeSec: 3,
    autoSpeak: false,
    subLens: false,
    targetLevel: 5,
    learningDirection: "en-ja",
  };

  /**
   * Write the test settings and prove they stuck.
   *
   * background.ts's onInstalled handler does its own read-modify-write of
   * settings, which raced this seed and silently restored DEFAULTS: the card
   * then ran the stock 15s clock while the test believed it was 3s, and the
   * pause assertions passed or failed on timing luck. Retry until the read-back
   * agrees, and fail loudly if it never does.
   */
  async function seedSettings() {
    for (let attempt = 0; attempt < 12; attempt++) {
      await sw.evaluate(
        (s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }),
        SETTINGS
      );
      await new Promise((r) => setTimeout(r, 250));
      const got = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
      if (
        got &&
        got.autoResumeSec === SETTINGS.autoResumeSec &&
        got.cooldownSec === SETTINGS.cooldownSec &&
        got.subLens === SETTINGS.subLens
      ) {
        return got;
      }
    }
    return null;
  }

  await ctx.route("https://www.youtube.com/**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("v") || "unknown";
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage(id) });
  });

  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (process.env.AVC_E2E_VERBOSE) console.log("   [page]", m.text());
  });
  await page.goto("https://www.youtube.com/watch?v=videoA", { waitUntil: "domcontentloaded" });

  // The pipeline loads kuromoji and the dictionary before the first card.
  await page.waitForFunction(() => !!document.querySelector("video"), null, { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
  await page.waitForTimeout(6000);

  const applied = await seedSettings();
  check(
    "test settings applied (3s dismissal clock, no cooldown, Lens off)",
    !!applied,
    applied ? "" : "onInstalled kept overwriting them"
  );
  if (!applied) throw new Error("could not apply test settings; later checks would be meaningless");

  /** Feed subtitle lines until a card is on screen. */
  async function cardOnScreen(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let i = 0;
    while (Date.now() < deadline) {
      await page.evaluate((line) => window.avcCaption(line), LINES[i++ % LINES.length]);
      try {
        await page.waitForSelector(CARD, { timeout: 4000, state: "attached" });
        return true;
      } catch {
        /* no card for that line; try the next one */
      }
    }
    return false;
  }

  // ── #127: a paused video holds its card ───────────────────────────────────
  check("a subtitle line raises a word card", await cardOnScreen());
  const word = await page.locator(`${CARD} .avc-agent-word`).first().innerText().catch(() => "");

  // The card has to be armed and counting for the pause test to mean anything:
  // one that mounted on a paused video would survive a pause either way.
  check(
    "the card is counting down on a playing video",
    await page.evaluate(() => !document.querySelector("video").paused)
  );

  await page.evaluate(() => {
    window.__events.length = 0;
    document.querySelector("video").pause();
  });
  const sawPause = await page
    .waitForFunction(() => window.__events.some((e) => e.startsWith("pause")), null, { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  check("the video reported the pause the card listens for", sawPause);
  await page.waitForTimeout(7000); // more than twice the 3s dismissal clock
  check(
    "#127 card survives a pause far longer than its dismissal clock",
    await page.locator(CARD).count() > 0,
    `word ${JSON.stringify(word)}`
  );
  const judgeButtons = await page.locator("#avc-overlay-host .avc-agent-foot.avc-active button").count();
  check("#127 Learn / Know / Skip still offered while paused", judgeButtons >= 2, `${judgeButtons} buttons`);

  const resumed = await page.evaluate(async () => {
    const v = document.querySelector("video");
    try {
      await v.play();
    } catch (err) {
      return `play() rejected: ${err}`;
    }
    return v.paused ? "still paused after play()" : "playing";
  });
  check(
    "the video reported the play the card listens for",
    await page.evaluate(() => window.__events.some((e) => e.startsWith("play")))
  );
  let clearedAfterMs = null;
  for (let waited = 0; waited <= 9000; waited += 500) {
    if (await page.locator(CARD).count() === 0) { clearedAfterMs = waited; break; }
    await page.waitForTimeout(500);
  }
  const stillUp = clearedAfterMs === null
    ? await page.locator(`${CARD} .avc-agent-word`).first().innerText().catch(() => "?")
    : "";
  check(
    "#127 the clock resumes on play, so the card still moves on",
    clearedAfterMs !== null,
    clearedAfterMs !== null
      ? `${resumed}, cleared after ${clearedAfterMs}ms`
      : `${resumed}, card still showing ${JSON.stringify(stillUp)} (was ${JSON.stringify(word)}), events ${JSON.stringify(await page.evaluate(() => window.__events))}`
  );

  // ── #125: a playlist advance drops the previous video's context ───────────
  check("a second line raises another card", await cardOnScreen());
  const staleLine = await page.evaluate(() => document.querySelector(".ytp-caption-segment").textContent);
  await page.evaluate(() => window.avcNavigate("videoB"));
  await page.waitForTimeout(3500); // the session watcher runs every 2s
  check("#125 navigating to the next video dismisses the card", await page.locator(CARD).count() === 0);

  // YouTube leaves the previous clip's caption node in place for a moment. It
  // must not raise a card on the new video, which is what QA saw.
  await page.evaluate((line) => window.avcCaption(line), staleLine);
  await page.waitForTimeout(2500);
  check(
    "#125 the previous video's caption text does not re-card",
    await page.locator(CARD).count() === 0,
    `stale line ${JSON.stringify(staleLine)}`
  );

  // The guard must not wedge the fallback: fresh dialogue on the new video has
  // to keep raising cards.
  check("#125 the new video's own dialogue still cards", await cardOnScreen(20000));
  await page.evaluate(() => window.avcCaption(""));

  // ── #128: say something when the study language has no captions ───────────
  await page.evaluate(() =>
    window.avcTracks([{ baseUrl: "https://www.youtube.com/api/timedtext?lang=en", languageCode: "en", kind: "" }])
  );
  await page.waitForSelector(TOAST, { timeout: 8000 }).catch(() => {});
  const toast = await page.locator(TOAST).first().innerText().catch(() => "");
  check(
    "#128 a video with no Japanese captions explains itself",
    /no japanese captions/i.test(toast) && /listening mode/i.test(toast),
    JSON.stringify(toast)
  );

  // ── #126: a reload restores the whole session ─────────────────────────────
  const tabId = await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://www.youtube.com/*" });
    return tab?.id ?? null;
  });
  check("found the watch tab from the service worker", tabId != null, `tab ${tabId}`);
  await sw.evaluate(
    (id) => chrome.storage.session.set({ listeningTabs: { [id]: true }, copilotTabs: { [id]: true } }),
    tabId
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check(
    "#126 the Copilot panel comes back with the listening session",
    await page.locator("#avc-overlay-host").count() > 0
  );
  const copilotStillOpen = await sw.evaluate(async (id) => {
    const r = await chrome.storage.session.get(["copilotTabs"]);
    return !!r.copilotTabs?.[id];
  }, tabId);
  check("#126 the panel reports itself open after the reload", copilotStillOpen);
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
