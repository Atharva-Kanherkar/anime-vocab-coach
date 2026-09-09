// Headed E2E for issue #132: the copilot must not stand between the learner and
// the host player's control cluster.
//
// Netflix itself is not driven: it needs an account and a licensed stream, and
// its DOM is not ours to depend on. Instead the served-watch-page harness from
// youtube-session.mjs gets a stand-in control bar pinned where Netflix's is
// (bottom right, ~140px tall), and the real content script runs against it. The
// question this answers is a geometry question, and geometry is honest here.
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const CONTROL_BAR_H = 140; // measured from Netflix's bottom controls container

const watchPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>panel layout - YouTube</title>
<style>
  html, body { margin: 0; height: 100%; background: #111; }
  #movie_player { position: relative; width: 100vw; height: 100vh; }
  /* Where Netflix keeps subtitles / speed / next episode / fullscreen. */
  #host-controls {
    position: fixed; right: 0; bottom: 0; left: 0; height: ${CONTROL_BAR_H}px;
    display: flex; align-items: center; justify-content: flex-end; gap: 16px;
    padding-right: 24px; background: rgba(0,0,0,0.6);
  }
  #host-controls button { padding: 12px 16px; font-size: 14px; }
</style></head><body>
<div id="movie_player">
  <video class="html5-main-video" width="640" muted></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
  <div id="host-controls">
    <button id="host-subtitles" type="button">Subtitles</button>
    <button id="host-speed" type="button">Speed</button>
    <button id="host-fullscreen" type="button">Fullscreen</button>
  </div>
</div>
<script>
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.__hostClicks = [];
  for (const id of ["host-subtitles", "host-speed", "host-fullscreen"]) {
    document.getElementById(id).addEventListener("click", () => window.__hostClicks.push(id));
  }
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
</script></body></html>`;

const SIDEBAR = "#avc-overlay-host .avc-agent-sidebar";
const CARD = "#avc-overlay-host .avc-agent-word-block.avc-active";
const LINES = ["父はまだ帰らない。", "約束を守ると言った。", "電車が遅れている。"];

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
  await page.goto("https://www.youtube.com/watch?v=panelLayout", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });

  const SETTINGS = {
    pauseMode: "copilot",
    cooldownSec: 0,
    maxCardsPerHour: 99,
    autoResumeSec: 120, // long enough that the card is still up for every check
    autoSpeak: false,
    subLens: false,
    targetLevel: 5,
    learningDirection: "en-ja",
  };
  // Written after load: background.ts's onInstalled read-modify-writes settings
  // and would otherwise restore DEFAULTS over the seed.
  let applied = false;
  for (let i = 0; i < 12 && !applied; i++) {
    await sw.evaluate((s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }), SETTINGS);
    await page.waitForTimeout(250);
    applied = await sw.evaluate(
      async (want) => (await chrome.storage.local.get("settings")).settings?.autoResumeSec === want,
      SETTINGS.autoResumeSec
    );
  }
  check("test settings applied", applied);
  await page.waitForTimeout(5000);

  // Open the panel the way the popup does, then raise a card in it.
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.youtube.com/*" }))[0]?.id);
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "avc-agent-show" }), tabId);
  await page.waitForSelector(SIDEBAR, { timeout: 8000 });
  check("copilot panel mounted", (await page.locator(SIDEBAR).count()) > 0);

  let carded = false;
  for (let i = 0; i < 9 && !carded; i++) {
    await page.evaluate((line) => window.avcCaption(line), LINES[i % LINES.length]);
    carded = await page
      .waitForSelector(CARD, { timeout: 4000, state: "attached" })
      .then(() => true)
      .catch(() => false);
  }
  check("a word card is up while we test the geometry", carded);

  // ── The panel clears the host control bar ─────────────────────────────────
  const geometry = await page.evaluate(() => {
    const sb = document
      .getElementById("avc-overlay-host")
      .shadowRoot.querySelector(".avc-agent-sidebar")
      .getBoundingClientRect();
    const bar = document.getElementById("host-controls").getBoundingClientRect();
    return { sidebarBottom: Math.round(sb.bottom), barTop: Math.round(bar.top), h: window.innerHeight };
  });
  check(
    "#132 the panel stops above the host control bar",
    geometry.sidebarBottom <= geometry.barTop,
    `sidebar bottom ${geometry.sidebarBottom}, bar top ${geometry.barTop}, viewport ${geometry.h}`
  );

  // Geometry is the mechanism; this is the outcome the learner cares about.
  for (const id of ["host-subtitles", "host-speed", "host-fullscreen"]) {
    await page.locator(`#${id}`).click({ timeout: 3000 }).catch(() => {});
  }
  const clicked = await page.evaluate(() => window.__hostClicks);
  check(
    "#132 every host control in the cluster is clickable with the panel open",
    clicked.length === 3,
    `reached ${JSON.stringify(clicked)}`
  );

  // The panel's own controls must still work.
  await page.evaluate(() =>
    document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-chat-input").focus()
  );
  check(
    "the panel still takes its own clicks",
    await page.evaluate(
      () =>
        document.getElementById("avc-overlay-host").shadowRoot.activeElement?.classList.contains("avc-agent-chat-input") === true
    )
  );

  // ── Collapse keeps the card ───────────────────────────────────────────────
  await page.evaluate(() =>
    document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-collapse").click()
  );
  await page.waitForTimeout(400);
  const railed = await page.evaluate(() => {
    const host = document.getElementById("avc-overlay-host").shadowRoot;
    const sb = host.querySelector(".avc-agent-sidebar");
    return {
      collapsed: sb.classList.contains("avc-collapsed"),
      width: Math.round(sb.getBoundingClientRect().width),
      cardStillMounted: !!host.querySelector(".avc-agent-word-block.avc-active"),
      hasCardMark: sb.classList.contains("avc-has-card"),
    };
  });
  check("#132 collapsing narrows the panel to a rail", railed.collapsed && railed.width <= 40, JSON.stringify(railed));
  check("#132 the card survives the collapse", railed.cardStillMounted && railed.hasCardMark, JSON.stringify(railed));

  // While railed, the strip the panel used to own belongs to the page again.
  const throughClick = await page.evaluate(() => {
    const x = Math.round(window.innerWidth - 120);
    const y = Math.round(window.innerHeight / 2);
    const el = document.elementFromPoint(x, y);
    return el?.id || el?.tagName || "none";
  });
  check(
    "#132 the collapsed strip passes clicks to the player",
    throughClick !== "avc-overlay-host",
    `elementFromPoint gave ${throughClick}`
  );

  // ── Expanding brings the same word back ───────────────────────────────────
  const wordBefore = await page.evaluate(
    () => document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-word")?.textContent
  );
  await page.evaluate(() =>
    document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-rail").click()
  );
  await page.waitForTimeout(400);
  const wordAfter = await page.evaluate(() => {
    const host = document.getElementById("avc-overlay-host").shadowRoot;
    return {
      collapsed: host.querySelector(".avc-agent-sidebar").classList.contains("avc-collapsed"),
      word: host.querySelector(".avc-agent-word")?.textContent,
    };
  });
  check(
    "#132 expanding restores the same card",
    !wordAfter.collapsed && !!wordAfter.word && wordAfter.word === wordBefore,
    `${JSON.stringify(wordBefore)} then ${JSON.stringify(wordAfter)}`
  );

  const persisted = await sw.evaluate(async () => (await chrome.storage.local.get("agentPanelCollapsed")).agentPanelCollapsed);
  check("#132 the collapse choice is remembered", persisted === false, `stored ${JSON.stringify(persisted)}`);
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
