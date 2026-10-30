// E2E for dual subtitles: romaji + English under a Netflix player that has
// Japanese subtitles and no English track (Netflix in Japan, for most anime).
//
// netflix.com and animevocab.com are both served from this script over local
// HTTPS: a Netflix-shaped player whose Japanese subtitle line the test sets,
// and a /api/ai/translate that answers like the real one after a delay. The
// extension under test is the shipped build.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:https";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const artifacts = process.env.DUAL_SUBS_ARTIFACTS || "/tmp/animevocab-dual-subs";
await mkdir(artifacts, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "dual-subs-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(temp, "key.pem"), "-out", join(temp, "cert.pem"), "-days", "1", "-subj", "/CN=avc-test"], { stdio: "ignore" });

const watchPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Netflix</title></head>
<body style="background:#111;margin:0"><div class="watch-video"><video width="960" height="540" muted></video>
<div class="player-timedtext"><div class="player-timedtext-text-container"></div></div></div>
<script>
  const v = document.querySelector("video"), c = document.createElement("canvas");
  c.width = 320; c.height = 180; const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10); v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".player-timedtext-text-container").textContent = t; };
  window.avcCaptionHtml = (h) => { document.querySelector(".player-timedtext-text-container").innerHTML = h; };
</script></body></html>`;

// What the model would say, keyed by line. Readings fix the tokenizer's 公生 (きみお).
const ANSWERS = {
  "公生、ピアノ弾いてよ。": { en: "Kousei, play the piano for me.", readings: { "0": "こうせい" } },
  "わたしは宮園かをりです。": { en: "I'm Kaori Miyazono.", readings: {} },
  "明日も会えるかな。": { en: "Will I see you tomorrow too?", readings: {} },
  "君は嘘をついていた。": { en: "You were lying.", readings: {} },
  "はじめまして。わたしは学生です。": { en: "Nice to meet you. I'm a student.", readings: {} },
  "宮園さん、こんにちは。": { en: "Hello, Miyazono.", readings: {} },
};
const DELAY_MS = 250;
let quotaExhausted = false;
const asked = [];
const server = createServer({ key: await readFile(join(temp, "key.pem")), cert: await readFile(join(temp, "cert.pem")) }, async (req, res) => {
  const host = req.headers.host?.split(":")[0];
  if (host === "www.netflix.com") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(watchPage); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  if (req.url === "/api/ai/translate") {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    asked.push({ ...body, at: Date.now() });
    await new Promise((r) => setTimeout(r, DELAY_MS));
    if (req.headers.authorization !== "Bearer avc_st_dual") { res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"unauthorized"}'); return; }
    if (quotaExhausted) { res.writeHead(429, { "Content-Type": "application/json" }).end('{"error":"subs_quota_exhausted"}'); return; }
    const answer = ANSWERS[body.line] ?? { en: "(unknown line)", readings: {} };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result: answer, cached: false }));
    return;
  }
  if (req.url.startsWith("/api/sync/token")) { res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"none"}'); return; }
  res.writeHead(204).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ext = resolve("extension");
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium", headless: !process.env.AVC_E2E_HEADED, viewport: { width: 1200, height: 760 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${port},MAP api.animevocab.com 127.0.0.1:${port},MAP www.netflix.com 127.0.0.1:${port}`, "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
});
const check = (name) => console.log("PASS " + name);
const lens = (page) => page.evaluate(() => {
  const root = document.querySelector("[data-avc-sub-lens]")?.shadowRoot;
  const on = root?.querySelector(".lens.on");
  return on ? { jp: on.querySelector(".line.jp")?.textContent ?? "", en: on.querySelector(".line.en:not(.pending)")?.textContent ?? "", pending: !!on.querySelector(".line.en.pending") } : null;
});
async function waitFor(page, pred, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    const v = await lens(page);
    if (v && pred(v)) return { ...v, ms: Date.now() - start };
    if (Date.now() - start > timeout) throw new Error("timed out; last lens state: " + JSON.stringify(v));
    await page.waitForTimeout(15);
  }
}

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  await sw.evaluate(async () => { for (let i = 0; i < 100; i++) { const s = await chrome.storage.local.get(["settings", "onboarding"]); if (s.settings && s.onboarding?.installedAt) return; await new Promise((r) => setTimeout(r, 50)); } });
  const settings = { pauseMode: "off", subLens: true, subLensPeek: false, learningDirection: "en-ja", displayScript: "romaji", cooldownSec: 0, maxCardsPerHour: 99, autoSpeak: false };
  await sw.evaluate((settings) => chrome.storage.local.set({ syncToken: "avc_st_dual", syncProfile: { name: "Learner", plan: "free" }, settings }), settings);

  const page = await ctx.newPage();
  await page.goto("https://www.netflix.com/watch/80041089");
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });
  await page.waitForTimeout(5000); // kuromoji + dictionary warm-up

  await page.evaluate(() => window.avcCaption("公生、ピアノ弾いてよ。"));
  const first = await waitFor(page, (v) => !!v.jp);
  assert.ok(first.jp.startsWith("K") && /piano/.test(first.jp), first.jp);
  assert.ok(first.ms < 400, `romaji took ${first.ms}ms`);
  const full = await waitFor(page, (v) => !!v.en);
  assert.equal(full.en, "Kousei, play the piano for me.");
  assert.equal(full.jp, "Kousei, piano hiite yo.");
  assert.equal(asked.at(-1).words[0].s, "公生");
  console.log(`   romaji in ${first.ms}ms, English in ${first.ms + full.ms}ms (server delay ${DELAY_MS}ms)`);
  await page.waitForTimeout(300); // let the English finish fading in
  await page.screenshot({ path: join(artifacts, "dual-romaji.png") });
  check("Netflix Japanese line → romaji at once, English and corrected name reading a moment later");

  const root = page.locator("[data-avc-sub-lens]");
  await root.locator(".line.jp .tok", { hasText: "piano" }).hover();
  await root.locator(".tip.on").waitFor();
  assert.match(await root.locator(".tip.on").textContent(), /ピアノ/);
  await page.mouse.move(5, 5);
  check("words in the romaji line still look up and save like the Lens");

  await page.evaluate(() => window.avcCaption("わたしは宮園かをりです。"));
  const second = await waitFor(page, (v) => v.en === "I'm Kaori Miyazono.");
  assert.equal(second.jp, "Watashi wa Miyasono Kaori desu.");
  assert.deepEqual(asked.at(-1).context, ["公生、ピアノ弾いてよ。"]);
  check("the previous line goes along as context");

  // A rewind: the same line again is answered from memory, with no request.
  const before = asked.length;
  await page.evaluate(() => window.avcCaption(""));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.avcCaption("公生、ピアノ弾いてよ。"));
  const again = await waitFor(page, (v) => v.en === "Kousei, play the piano for me.");
  assert.ok(again.ms < 200, `rewound line took ${again.ms}ms`);
  assert.equal(asked.length, before);
  check("a rewound line shows its English instantly, without asking again");

  // Listening: a cached transcript arrives seconds early; its English is fetched then.
  const t = await page.evaluate(() => document.querySelector("video").currentTime);
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.netflix.com/*" }))[0].id);
  await sw.evaluate(({ tabId, start }) => chrome.tabs.sendMessage(tabId, { type: "avc-transcript", text: "明日も会えるかな。", start, end: start + 2 }), { tabId, start: t + 2.5 });
  await page.waitForTimeout(600);
  assert.ok(asked.some((a) => a.line === "明日も会えるかな。"), "translated ahead of its moment");
  const heard = await waitFor(page, (v) => v.jp.startsWith("Ashita"), 6000);
  assert.equal(heard.en, "Will I see you tomorrow too?", "English is there the moment the line is");
  check("a line heard ahead of its moment has its English ready when it is shown");

  // Two sentences in one subtitle: both start with a capital on screen.
  await page.evaluate(() => window.avcCaption("はじめまして。わたしは学生です。"));
  const two = await waitFor(page, (v) => v.en === "Nice to meet you. I'm a student.");
  assert.equal(two.jp, "Hajimemashite. Watashi wa gakusei desu.");
  check("every sentence in a subtitle starts with a capital on screen");

  // English already on the page: a line heard early is not translated ahead.
  await page.evaluate(() => window.avcCaption("See you tomorrow."));
  await page.waitForTimeout(300);
  const t2 = await page.evaluate(() => document.querySelector("video").currentTime);
  await sw.evaluate(({ tabId, start }) => chrome.tabs.sendMessage(tabId, { type: "avc-transcript", text: "また明日会おう。", start, end: start + 2 }), { tabId, start: t2 + 2 });
  await page.waitForTimeout(800);
  assert.ok(!asked.some((a) => a.line === "また明日会おう。"), "no translation spent while the page shows English");
  const native = await waitFor(page, (v) => v.jp.startsWith("Mata"), 6000);
  assert.equal(native.en, "See you tomorrow.", "the page's own English is used");
  assert.ok(!asked.some((a) => a.line === "また明日会おう。"));
  await page.evaluate(() => window.avcCaption(""));
  check("with English on the page, nothing is translated ahead and the page's English is shown");

  // Furigana above a word is not part of the line.
  await page.evaluate(() => window.avcCaptionHtml("<ruby>宮園<rt>みやぞの</rt></ruby>さん、こんにちは。"));
  const ruby = await waitFor(page, (v) => v.en === "Hello, Miyazono.");
  assert.equal(asked.at(-1).line, "宮園さん、こんにちは。");
  assert.ok(!/miyazonomiyazono|みやぞのみやぞの/i.test(ruby.jp), ruby.jp);
  check("Netflix furigana is left out of the line");

  // Kana, when the learner reads kana.
  await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get("settings"); await chrome.storage.local.set({ settings: { ...settings, displayScript: "kana" } }); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.avcCaption("君は嘘をついていた。"));
  const kana = await waitFor(page, (v) => !!v.en && v.jp.includes("うそ"));
  assert.ok(!/[A-Za-z]/.test(kana.jp), kana.jp);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(artifacts, "dual-kana.png") });
  check("kana learners get kana with English");

  // Out of lines this month: romaji keeps working, and the learner is told once.
  quotaExhausted = true;
  await page.evaluate(() => window.avcCaption("はじめまして。"));
  await waitFor(page, (v) => v.jp.startsWith("はじめまして") && !v.pending, 6000);
  await page.locator("#avc-overlay-host").getByText("English subtitles are paused").waitFor();
  check("a used-up limit keeps the Japanese line and says why the English stopped");
} finally {
  await ctx.close(); await new Promise((r) => server.close(r)); await rm(temp, { recursive: true, force: true });
}
