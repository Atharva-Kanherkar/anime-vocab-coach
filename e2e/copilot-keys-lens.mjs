// E2E for the copilot keyboard leak and the late Subtitle Lens.
//
// netflix.com is served from this script: a page with Netflix's subtitle
// container, a canvas-backed <video>, a DOM that never stops mutating (like the
// real player's clock and progress bar), and a player-style shortcut bound on
// the window in the capture phase: Space toggles playback, as Netflix's does.
// The extension under test is the shipped build; nothing in it is mocked.
import { chromium } from "playwright";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

const watchPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>Netflix</title></head><body style="background:#111;color:#eee;margin:0">
<script>
  // The player's shortcuts, bound before any content script at idle can run.
  window.__pageKeys = [];
  window.addEventListener("keydown", (e) => {
    window.__pageKeys.push(e.key);
    if (e.key === " ") {
      const v = document.querySelector("video");
      if (v) v.paused ? v.play() : v.pause();
    }
  }, true);
</script>
<div class="watch-video">
  <video width="960" height="540" muted></video>
  <div class="player-timedtext"><div class="player-timedtext-text-container"></div></div>
  <div class="clock"></div>
</div>
<script>
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.__pauses = 0;
  v.addEventListener("pause", () => { window.__pauses++; });
  // A streaming player's DOM is never quiet. Under the old 100ms debounce this
  // churn kept pushing the subtitle read back indefinitely.
  setInterval(() => { document.querySelector(".clock").textContent = String(Date.now()); }, 40);
  window.avcCaption = (t) => { document.querySelector(".player-timedtext-text-container").textContent = t; };
</script></body></html>`;

const CARD = "#avc-overlay-host .avc-agent-word-block.avc-active";
const CHAT = "#avc-overlay-host .avc-agent-chat-input";
const LINES = ["父はまだ帰らない。", "約束を守ると言った。", "電車が遅れている。", "明日は雨が降るそうだ。"];

const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: !process.env.AVC_E2E_HEADED,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const SETTINGS = {
    pauseMode: "copilot",
    cooldownSec: 0,
    maxCardsPerHour: 99,
    autoResumeSec: 60,
    autoSpeak: false,
    subLens: true,
    subLensPeek: false,
    targetLevel: 5,
    learningDirection: "en-ja",
  };
  async function seedSettings() {
    for (let attempt = 0; attempt < 12; attempt++) {
      await sw.evaluate(
        (s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }),
        SETTINGS
      );
      await new Promise((r) => setTimeout(r, 250));
      const got = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
      if (got && got.autoResumeSec === SETTINGS.autoResumeSec && got.subLens === true) return true;
    }
    return false;
  }

  await ctx.route("https://www.netflix.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage })
  );
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (process.env.AVC_E2E_VERBOSE) console.log("   [page]", m.text());
  });
  await page.goto("https://www.netflix.com/watch/81234567", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
  check("test settings applied", await seedSettings());
  await page.waitForTimeout(6000); // kuromoji + dictionary warm-up

  const lensText = () =>
    page.evaluate(() => {
      const host = document.querySelector("[data-avc-sub-lens]");
      const lens = host?.shadowRoot?.querySelector(".lens");
      return lens && lens.classList.contains("on") ? lens.querySelector(".line.jp")?.textContent || "" : "";
    });
  async function lensShows(line, timeoutMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if ((await lensText()) === line) return Date.now() - t0;
      await page.waitForTimeout(25);
    }
    return null;
  }

  // ── The Lens reads the line promptly, even on a DOM that never goes quiet ──
  await page.evaluate((l) => window.avcCaption(l), LINES[0]);
  const firstMs = await lensShows(LINES[0], 5000);
  check("Lens mirrors a new subtitle despite constant DOM churn", firstMs !== null, `${firstMs}ms`);

  // ── A card comes up; the Lens must keep following the video behind it ─────
  let carded = false;
  for (let i = 1; i < 12 && !carded; i++) {
    await page.evaluate((l) => window.avcCaption(l), LINES[i % LINES.length]);
    carded = await page.waitForSelector(CARD, { timeout: 3000, state: "attached" }).then(() => true, () => false);
  }
  check("a subtitle line raises a word card", carded);

  const behind = "猫が窓の外を見ている。";
  await page.evaluate((l) => window.avcCaption(l), behind);
  const behindMs = await lensShows(behind, 3000);
  check("Lens updates while a card is open (not queued behind it)", behindMs !== null, `${behindMs}ms`);

  // ── The native line clears; the Lens follows it off ────────────────────────
  await page.evaluate(() => window.avcCaption(""));
  let hiddenMs = null;
  for (let waited = 0; waited <= 2000; waited += 50) {
    if ((await lensText()) === "") { hiddenMs = waited; break; }
    await page.waitForTimeout(50);
  }
  check("Lens hides when the native subtitle clears", hiddenMs !== null, `${hiddenMs}ms`);

  // ── Typing to the copilot never reaches the player ─────────────────────────
  // Open it the way the popup does, so this part stands on its own.
  await sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "https://www.netflix.com/*" });
    await chrome.tabs.sendMessage(tab.id, { type: "avc-agent-show" });
  });
  await page.waitForSelector(CHAT, { timeout: 5000, state: "attached" });
  const cardBefore = (await page.locator(CARD).count()) > 0;
  await page.evaluate(() => { window.__pageKeys.length = 0; window.__pauses = 0; });
  await page.locator(CHAT).click();
  const typed = "what does 2 mean here";
  await page.keyboard.type(typed, { delay: 15 });
  const afterTyping = await page.evaluate(() => ({
    pageKeys: window.__pageKeys.slice(),
    pauses: window.__pauses,
    paused: document.querySelector("video").paused,
  }));
  check("the page saw none of the keys typed into the chat", afterTyping.pageKeys.length === 0,
    JSON.stringify(afterTyping.pageKeys.slice(0, 8)));
  // Counted, not read at the end: an even number of spaces toggles back to playing.
  check("Space in the chat never paused the video", afterTyping.pauses === 0 && !afterTyping.paused,
    `${afterTyping.pauses} pause(s)`);
  const value = await page.locator(CHAT).inputValue();
  check("the chat received every character, spaces included", value === typed, JSON.stringify(value));
  // The card is a precondition, not an option: without it this check would
  // quietly vanish and the judge-key coverage with it.
  check("a card was open to be judged by a stray '2'", cardBefore);
  check("typing '2' in the chat did not judge the card", cardBefore && (await page.locator(CARD).count()) > 0);

  // ── The page's own shortcuts still work when focus is on the page ──────────
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.__pageKeys.length = 0;
  });
  await page.locator(CHAT).evaluate((el) => el.blur());
  await page.mouse.click(200, 200);
  await page.keyboard.press(" ");
  const pageSpace = await page.evaluate(() => ({
    pageKeys: window.__pageKeys.slice(),
    paused: document.querySelector("video").paused,
  }));
  check("Space on the page still reaches the player", pageSpace.pageKeys.includes(" "),
    JSON.stringify(pageSpace));

  // ── Every sentence of a heard utterance counts as seen ─────────────────────
  // Listening Mode delivers an utterance whole and it is split per sentence.
  // A newest-wins queue once kept only the first and last of them. The open
  // card holds the pipeline for its lifetime, so skip it first.
  await page.locator("#avc-overlay-host .avc-agent-foot.avc-active button").last().click();
  await page.waitForSelector(CARD, { state: "detached", timeout: 5000 }).catch(() => {});
  const SENTENCES = ["犬が走る。", "猫が寝る。", "鳥が歌う。", "魚が泳ぐ。"];
  const WORDS = ["犬", "猫", "鳥", "魚"];
  await sw.evaluate(async (text) => {
    const [tab] = await chrome.tabs.query({ url: "https://www.netflix.com/*" });
    await chrome.tabs.sendMessage(tab.id, { type: "avc-transcript", text });
  }, SENTENCES.join(""));
  let seenWords = [];
  for (let waited = 0; waited <= 8000; waited += 250) {
    const vocab = await sw.evaluate(async () => (await chrome.storage.local.get("vocab")).vocab || {});
    seenWords = WORDS.filter((w) => vocab[w] && vocab[w].seenCount > 0);
    if (seenWords.length === WORDS.length) break;
    await page.waitForTimeout(250);
  }
  check("every sentence of a multi-sentence transcript is counted as seen",
    seenWords.length === WORDS.length, `seen ${JSON.stringify(seenWords)} of ${JSON.stringify(WORDS)}`);
} catch (err) {
  console.error(err);
  results.push(false);
} finally {
  await ctx.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
