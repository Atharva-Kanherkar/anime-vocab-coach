// E2E (ISO 25010 usability: user error protection): a judgment can be taken
// back, from the copilot card and from the subtitle Lens tip, and the word is
// left exactly as it was. Also runs axe on the panel's idle state, where the
// Undo line lives.
//
//   node e2e/undo.mjs [path/to/extension]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { NO_PRODUCTION_ARGS, keepOffProduction } from "./support/no-production.mjs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const AXE = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`); };

const watchPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>undo - YouTube</title>
<style>html, body { margin: 0; height: 100%; background: #111; } #movie_player { position: relative; width: 100vw; height: 100vh; }</style>
</head><body><div id="movie_player">
  <video class="html5-main-video" width="640" muted></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
</div><script>
  const v = document.querySelector("video"); const c = document.createElement("canvas"); c.width = 320; c.height = 180;
  const g = c.getContext("2d"); setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10); v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
</script></body></html>`;
// The Lens mirrors on-screen subtitles; on YouTube it reads the caption track
// instead, so its half runs on a Netflix-shaped page (as copilot-keys-lens does).
const netflixPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Netflix</title></head>
<body style="background:#111;color:#eee;margin:0"><div class="watch-video">
  <video width="960" height="540" muted></video>
  <div class="player-timedtext"><div class="player-timedtext-text-container"></div></div>
</div><script>
  const v = document.querySelector("video"); const c = document.createElement("canvas"); c.width = 320; c.height = 180;
  const g = c.getContext("2d"); setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10); v.play().catch(() => {});
  window.avcCaption = (t) => {
    document.querySelector(".player-timedtext-text-container").innerHTML = t ? "<span>" + t + "</span>" : "";
  };
</script></body></html>`;
const LINES = ["父はまだ帰らない。", "約束を守ると言った。", "電車が遅れている。"];
const BASE_SETTINGS = { cooldownSec: 0, maxCardsPerHour: 99, autoResumeSec: 120, autoSpeak: false, targetLevel: 5, learningDirection: "en-ja" };

const ctx = await chromium.launchPersistentContext("", {
  // The full chromium channel: the default headless shell cannot load extensions.
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  args: [...NO_PRODUCTION_ARGS, `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
// Beacons and the account-link probe stay off the real site (support/no-production.mjs).
await keepOffProduction(ctx);
try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  await ctx.route("https://www.youtube.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage }));
  await ctx.route("https://www.netflix.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: netflixPage }));
  const vocab = () => sw.evaluate(async () => (await chrome.storage.local.get("vocab")).vocab || {});
  // Written after load and re-checked: onInstalled read-modify-writes settings.
  async function seed(page, settings) {
    for (let i = 0; i < 12; i++) {
      await sw.evaluate((s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }), settings);
      await page.waitForTimeout(250);
      const got = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
      if (got?.pauseMode === settings.pauseMode && got?.subLens === settings.subLens) return true;
    }
    return false;
  }
  async function openWatch(settings, url = "https://www.youtube.com/watch?v=undoTest") {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
    check(`settings applied (${settings.pauseMode}, lens ${settings.subLens ? "on" : "off"})`, await seed(page, settings));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
    await page.waitForTimeout(5000); // kuromoji + dictionary warm-up
    return page;
  }

  // ── The copilot card ──────────────────────────────────────────────────────
  const page = await openWatch({ ...BASE_SETTINGS, pauseMode: "copilot", subLens: false });
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.youtube.com/*" }))[0]?.id);
  await sw.evaluate((id) => chrome.tabs.sendMessage(id, { type: "avc-agent-show" }), tabId);
  let carded = false;
  for (let i = 0; i < 9 && !carded; i++) {
    await page.evaluate((l) => window.avcCaption(l), LINES[i % LINES.length]);
    carded = await page.waitForSelector("#avc-overlay-host .avc-agent-word-block.avc-active", { timeout: 4000, state: "attached" }).then(() => true, () => false);
  }
  check("a word card comes up", carded);
  const before = await vocab();
  await page.evaluate(() => document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-know").click());
  let judged = null;
  for (let i = 0; i < 40 && !judged; i++) {
    await page.waitForTimeout(100);
    const now = await vocab();
    judged = Object.keys(now).find((k) => now[k].state === "known" && before[k]?.state !== "known") || null;
  }
  check("Know marks the carded word known", !!judged, judged || "none");
  const undoText = await page.evaluate(() => document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-undo")?.textContent || "");
  check("the panel offers Undo for it", undoText.includes("Undo") && undoText.includes(judged), undoText);

  await page.evaluate(AXE);
  const idleAxe = await page.evaluate(async () => (await window.axe.run({ include: [["#avc-overlay-host"]] },
    { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] })).violations.map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0].target.flat().join(" > ")}`));
  check("the idle panel with its Undo line has no axe violations", idleAxe.length === 0, idleAxe.join(" | "));

  await page.evaluate(() => document.getElementById("avc-overlay-host").shadowRoot.querySelector(".avc-agent-undo button").click());
  let restored = false;
  for (let i = 0; i < 40 && !restored; i++) {
    await page.waitForTimeout(100);
    const now = await vocab();
    restored = JSON.stringify(now[judged] ?? null) === JSON.stringify(before[judged] ?? null);
  }
  check("Undo puts the word back exactly as it was", restored);
  await page.close();

  // ── The subtitle Lens tip ─────────────────────────────────────────────────
  const lensPage = await openWatch({ ...BASE_SETTINGS, pauseMode: "off", subLens: true }, "https://www.netflix.com/watch/81234567");
  await lensPage.evaluate((l) => window.avcCaption(l), LINES[1]);
  const tok = await lensPage.waitForFunction(() => {
    const root = document.querySelector("[data-avc-sub-lens]")?.shadowRoot;
    const t = root?.querySelector(".lens.on .line.jp .tok.new");
    if (!t) return null;
    t.dispatchEvent(new MouseEvent("mouseenter"));
    return t.textContent;
  }, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => null);
  check("a Lens word can be hovered", !!tok, tok || "none");
  const lensBefore = await vocab();
  await lensPage.evaluate(() => document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".tip.on .tip-actions .tip-btn.primary").click());
  let saved = null;
  for (let i = 0; i < 40 && !saved; i++) {
    await lensPage.waitForTimeout(100);
    const now = await vocab();
    saved = Object.keys(now).find((k) => now[k].state === "learning" && lensBefore[k]?.state !== "learning") || null;
  }
  check("Learn from the tip puts the word in the deck", !!saved, saved || "none");
  const hasUndo = await lensPage.evaluate(() => !!document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".tip.on .tip-undo"));
  check("the tip offers Undo", hasUndo);
  await lensPage.evaluate(() => document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".tip.on .tip-undo").click());
  let lensRestored = false;
  for (let i = 0; i < 40 && !lensRestored; i++) {
    await lensPage.waitForTimeout(100);
    const now = await vocab();
    lensRestored = JSON.stringify(now[saved] ?? null) === JSON.stringify(lensBefore[saved] ?? null);
  }
  check("Undo from the tip puts the word back exactly as it was", lensRestored);
  const offersLearnAgain = await lensPage.evaluate(() => !!document.querySelector("[data-avc-sub-lens]").shadowRoot.querySelector(".tip.on .tip-actions .tip-btn.primary"));
  check("the tip offers the judgment buttons again", offersLearnAgain);
} finally {
  await ctx.close();
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exit(1);
