// E2E for dual subtitles from Netflix's own subtitle tracks.
//
// A Netflix-shaped player parses a manifest like the real one (through
// JSON.parse, as the player does), and its subtitle files are served from a
// fake Netflix CDN host. Two videos: one whose region has an English track,
// one with Japanese only (Netflix in Japan), where the episode's English is
// translated ahead by /api/ai/translate-batch. Each line's appearance is
// measured against the video's own clock, frame by frame, in the page.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:https";
import { mkdtemp, readFile, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const artifacts = process.env.NETFLIX_TRACKS_ARTIFACTS || "/tmp/animevocab-netflix-tracks";
await mkdir(artifacts, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "netflix-tracks-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(temp, "key.pem"), "-out", join(temp, "cert.pem"), "-days", "1", "-subj", "/CN=avc-test"], { stdio: "ignore" });

// Lines start once the extension has had time to load its dictionary.
const FIRST = 7, GAP = 2, LEN = 1.5;
const LINES = [
  ["公生、ピアノ弾いてよ。", "Kousei, play the piano for me."],
  ["はじめまして。", "Nice to meet you."],
  ["わたしは宮園かをりです。", "I'm Kaori Miyazono."],
  ["明日も会えるかな。", "Will I see you tomorrow?"],
  ["君は嘘をついていた。", "You were lying."],
  ["ピアノが好きです。", "I love the piano."],
];
const cue = (i) => ({ start: FIRST + i * GAP, end: FIRST + i * GAP + LEN });
const ticks = (s) => `${Math.round(s * 10_000_000)}t`;
const imscFor = (shift) => `<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xmlns:ttp="http://www.w3.org/ns/ttml#parameter" ttp:tickRate="10000000" xml:lang="ja">
<head><styling><style xml:id="rc" tts:ruby="container"/><style xml:id="rb" tts:ruby="base"/><style xml:id="rt" tts:ruby="text"/></styling></head>
<body><div>${LINES.map(([ja], i) => {
  const body = ja.startsWith("公生") ? `<span style="rc"><span style="rb">公生</span><span style="rt">こうせい</span></span>${ja.slice(2)}` : ja;
  return `<p begin="${ticks(cue(i).start + shift)}" end="${ticks(cue(i).end + shift)}">${body}</p>`;
}).join("\n")}</div></body></tt>`;
const fmt = (s) => `00:00:${String(Math.floor(s)).padStart(2, "0")}.${String(Math.round((s % 1) * 1000)).padStart(3, "0")}`;
const vtt = `WEBVTT\n\n${LINES.map(([, en], i) => `${i + 1}\n${fmt(cue(i).start)} --> ${fmt(cue(i).end)}\n${en}`).join("\n\n")}\n`;

const manifestFor = (movieId, withEnglish, jaUrls = true) => JSON.stringify({
  version: 2,
  result: {
    movieId: Number(movieId),
    timedtexttracks: [
      { language: "ja", rawTrackType: "subtitles", isForcedNarrative: false, isNoneTrack: false,
        ttDownloadables: jaUrls ? { "nflx-cmisc": { urls: [{ url: "https://ipv4-c001.nflxvideo.net/ja.zip" }] }, "imsc1.1": { urls: [{ cdn_id: 1, url: `https://ipv4-c001.nflxvideo.net/${movieId}/ja.xml?o=1` }] } } : {} },
      ...(withEnglish ? [{ language: "en", rawTrackType: "subtitles", isForcedNarrative: false, isNoneTrack: false,
        ttDownloadables: { "webvtt-lssdh-ios8": { urls: [{ url: `https://ipv4-c001.nflxvideo.net/${movieId}/en.vtt?o=1` }] } } }] : []),
      { language: "en", rawTrackType: "subtitles", isForcedNarrative: true, ttDownloadables: { "imsc1.1": { urls: [{ url: "https://ipv4-c001.nflxvideo.net/forced.xml" }] } } },
    ],
  },
});

// The DOM subtitle shows something else entirely: if it ever reaches our
// subtitles, the DOM path is still driving them.
const watchPage = (movieId, withEnglish) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Netflix</title>
<script>JSON.parse(${JSON.stringify(manifestFor(movieId, withEnglish))});</script></head>
<body style="background:#111;margin:0"><div class="watch-video"><video width="960" height="540" muted></video>
<div class="player-timedtext"><div class="player-timedtext-text-container">ちがう字幕です。</div></div></div>
<script>
  const v = document.querySelector("video"), c = document.createElement("canvas");
  c.width = 320; c.height = 180; const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(30); v.play().catch(() => {});
</script></body></html>`;

// Netflix as it is now: the manifest lists Japanese without a URL, the player
// fetches one only once Japanese is selected, its clock runs 3 s ahead of the
// <video> element's (as when the element's timeline also counts ads), and it
// draws its own Japanese line on the content clock.
const OFFSET = 3;
const playerPage = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>Netflix</title>
<script>JSON.parse(${JSON.stringify(manifestFor("333", false, false))});</script></head>
<body style="background:#111;margin:0"><div class="watch-video"><video width="960" height="540" muted></video>
<div class="player-timedtext"><div class="player-timedtext-text-container"></div></div></div>
<script>
  const v = document.querySelector("video"), c = document.createElement("canvas");
  c.width = 320; c.height = 180; const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(30); v.play().catch(() => {});
  const OFFSET = ${OFFSET};
  const CUES = ${JSON.stringify(LINES.map(([ja], i) => ({ ...cue(i), ja })))}.map((c) => ({ ...c, start: c.start + OFFSET, end: c.end + OFFSET }));
  const tracks = [{ trackId: "T-off", bcp47: "", isNoneTrack: true }, { trackId: "T-ja", bcp47: "ja", rawTrackType: "SUBTITLES", isImageBased: false, isForcedNarrative: false }];
  let current = tracks[0];
  window.__trackCalls = [];
  const state = { deep: { deeper: { list: [] } } };
  const player = {
    getMovieId: () => 333,
    getTimedTextTrackList: () => tracks,
    getTimedTextTrack: () => current,
    setTimedTextTrack: async (t) => {
      window.__trackCalls.push(t.trackId); current = t;
      if (t.trackId === "T-ja" && !state.deep.deeper.list.length) setTimeout(() => state.deep.deeper.list.push({ type: "timedtext", trackId: "T-ja", urls: [{ url: "https://ipv4-c001.nflxvideo.net/333/ja.xml?o=1" }] }), 300);
    },
    getCurrentTime: () => (v.currentTime + OFFSET) * 1000,
  };
  window.netflix = { appContext: { state: { playerApp: {
    getAPI: () => ({ videoPlayer: { getAllPlayerSessionIds: () => ["s1"], getVideoPlayerBySessionId: () => player } }),
    getState: () => ({ videoPlayer: { cadmiumPlayerRepository: { playersById: { s1: state } } } }),
  } } } };
  // Netflix's own Japanese line, on the content clock.
  const box = document.querySelector(".player-timedtext-text-container");
  (function draw() { const t = v.currentTime + OFFSET; const c = CUES.find((c) => t >= c.start && t < c.end); const text = c ? c.ja : ""; if (box.textContent !== text) box.textContent = text; requestAnimationFrame(draw); })();
</script></body></html>`;

const batches = [], singles = [];
const server = createServer({ key: await readFile(join(temp, "key.pem")), cert: await readFile(join(temp, "cert.pem")) }, async (req, res) => {
  const host = req.headers.host?.split(":")[0];
  const url = new URL(req.url, `https://${host}`);
  if (host === "www.netflix.com") {
    const id = url.pathname.match(/\/watch\/(\d+)/)?.[1] || "0";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(id === "333" ? playerPage : watchPage(id, id === "111"));
    return;
  }
  if (host === "ipv4-c001.nflxvideo.net") {
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (url.pathname.endsWith("/ja.xml")) { res.writeHead(200, { ...cors, "Content-Type": "text/xml" }).end(imscFor(url.pathname.startsWith("/333/") ? OFFSET : 0)); return; }
    if (url.pathname.endsWith("/en.vtt")) { res.writeHead(200, { ...cors, "Content-Type": "text/vtt" }).end(vtt); return; }
    res.writeHead(404, cors).end(); return;
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
  if (url.pathname === "/api/ai/translate-batch") {
    batches.push(body);
    await new Promise((r) => setTimeout(r, 300));
    const en = body.lines.map((l) => LINES.find(([ja]) => ja === l)?.[1] ?? "(?)");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result: { en, names: { 宮園: "みやぞの" } } }));
    return;
  }
  if (url.pathname === "/api/ai/translate") {
    singles.push(body);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result: { en: "(per line)", readings: {} } }));
    return;
  }
  if (url.pathname.startsWith("/api/sync/token")) { res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"none"}'); return; }
  res.writeHead(204).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
let ext = resolve("extension");
// Force the account-read race without changing the production bundle. All
// Netflix cases below must still fetch tracks and show their first cue on time.
const gateDelay = Number(process.env.AVC_E2E_GATE_DELAY_MS || 0);
if (gateDelay > 0) {
  const delayed = join(temp, "extension");
  await cp(ext, delayed, { recursive: true });
  const content = join(delayed, "content.js");
  await writeFile(content, `(() => {
    const get = chrome.storage.local.get.bind(chrome.storage.local);
    chrome.storage.local.get = (keys, cb) => {
      if (Array.isArray(keys) && keys.includes('syncToken') && cb) {
        return get(keys, value => setTimeout(() => cb(value), ${gateDelay}));
      }
      return cb ? get(keys, cb) : get(keys);
    };
  })();\n` + await readFile(content, "utf8"));
  ext = delayed;
}
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium", headless: !process.env.AVC_E2E_HEADED, viewport: { width: 1200, height: 760 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${port},MAP api.animevocab.com 127.0.0.1:${port},MAP www.netflix.com 127.0.0.1:${port},MAP ipv4-c001.nflxvideo.net 127.0.0.1:${port}`, "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
});
const check = (name) => console.log("PASS " + name);

/** Record, every frame, what our subtitles show against the video's clock. */
async function record(page) {
  await page.evaluate(() => {
    window.__seen = [];
    let last = "";
    const loop = () => {
      const root = document.querySelector("[data-avc-sub-lens]")?.shadowRoot;
      const on = root?.querySelector(".lens.on");
      const jp = on ? on.querySelector(".line.jp")?.textContent ?? "" : "";
      const en = on ? on.querySelector(".line.en")?.textContent ?? "" : "";
      const key = jp + "|" + en;
      if (key !== last) { window.__seen.push({ t: document.querySelector("video").currentTime, jp, en }); last = key; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

async function watch(page, label, shot) {
  await page.waitForFunction((t) => document.querySelector("video").currentTime > t, cue(2).start + 0.6, { timeout: 60000, polling: 50 });
  await page.screenshot({ path: shot });
  await page.waitForFunction((end) => document.querySelector("video").currentTime > end, cue(LINES.length - 1).end + 0.8, { timeout: 60000, polling: 200 });
  const seen = await page.evaluate(() => window.__seen);
  const report = [];
  LINES.forEach(([ja, en], i) => {
    const shown = seen.find((s) => s.jp && s.t >= cue(i).start - 0.3 && s.t < cue(i).end && !seen.some((p) => p.t < s.t && p.t >= cue(i).start - 0.3 && p.jp === s.jp && p !== s && false));
    assert.ok(shown, `${label}: line ${i} (${ja}) never shown; saw ${JSON.stringify(seen.slice(-12))}`);
    const late = shown.t - cue(i).start;
    const withEn = seen.find((s) => s.jp === shown.jp && s.en && s.t >= cue(i).start - 0.3 && s.t < cue(i).end);
    assert.ok(withEn, `${label}: line ${i} had no English`);
    assert.equal(withEn.en, en);
    const hidden = seen.find((s) => s.t >= cue(i).end - 0.05 && s.t < cue(i).end + 0.4 && !s.jp);
    report.push({ i, appearMs: Math.round(late * 1000), englishMs: Math.round((withEn.t - cue(i).start) * 1000), goneMs: hidden ? Math.round((hidden.t - cue(i).end) * 1000) : null });
    assert.ok(late > -0.08 && late < 0.12, `${label}: line ${i} appeared ${Math.round(late * 1000)}ms from its cue`);
    assert.ok(hidden, `${label}: line ${i} not taken down at its end`);
  });
  assert.ok(!seen.some((s) => s.jp.includes("chigau") || s.jp.includes("ちがう")), "the DOM subtitle never drives ours");
  return report;
}

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  await sw.evaluate(async () => { for (let i = 0; i < 100; i++) { const s = await chrome.storage.local.get(["settings", "onboarding"]); if (s.settings && s.onboarding?.installedAt) return; await new Promise((r) => setTimeout(r, 50)); } });
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_tracks", syncProfile: { name: "Learner", plan: "free" }, settings: { pauseMode: "off", subLens: true, subLensPeek: false, learningDirection: "en-ja", displayScript: "romaji", cooldownSec: 0, maxCardsPerHour: 99, autoSpeak: false } }));

  // 1. The region has an English track: both lines are official and on time.
  const a = await ctx.newPage();
  await a.goto("https://www.netflix.com/watch/111");
  await record(a);
  // Before the first line: the tracks arrive with the page, often before the
  // extension has loaded its settings, and Netflix's own subtitles must
  // still go.
  await a.waitForFunction(() => getComputedStyle(document.querySelector(".player-timedtext")).opacity === "0", null, { timeout: 5000 })
    .catch(() => { throw new Error("Netflix's own subtitles still showing before the first line"); });
  assert.ok(await a.evaluate(() => document.querySelector("video").currentTime) < 7, "hidden before the first line");
  const reportA = await watch(a, "English track", join(artifacts, "english-track.png"));
  console.log("   English track, per line (ms after cue start / after cue end):", JSON.stringify(reportA));
  assert.equal(batches.length, 0, "no translation when Netflix has the English");
  assert.equal(singles.length, 0);
  assert.equal(await a.evaluate(() => getComputedStyle(document.querySelector(".player-timedtext")).opacity), "0", "Netflix's own subtitles hidden");
  const seenA = await a.evaluate(() => window.__seen);
  assert.ok(seenA.some((s) => s.jp === "Kousei, piano hiite yo."), "furigana reads the name: " + JSON.stringify(seenA.slice(0, 6)));
  check("English track: romaji + Netflix's English, each line within a frame or two of its cue, taken down at its end");
  await a.close();

  // 2. Japanese only (Netflix in Japan): the episode's English is translated ahead.
  const b = await ctx.newPage();
  await b.goto("https://www.netflix.com/watch/222");
  await record(b);
  await b.waitForFunction(() => document.querySelector("video").currentTime > 1, null, { timeout: 20000 });
  const reportB = await watch(b, "Translated ahead", join(artifacts, "translated-ahead.png"));
  console.log("   Translated ahead, per line (ms after cue start / after cue end):", JSON.stringify(reportB));
  assert.equal(batches.length, 1, "one chunk for the whole (short) episode");
  assert.deepEqual(batches[0].lines, LINES.map(([ja]) => ja));
  assert.equal(singles.length, 0, "no per-line requests while watching");
  for (const r of reportB) assert.ok(r.englishMs - r.appearMs < 50, `line ${r.i}: English ${r.englishMs}ms vs Japanese ${r.appearMs}ms`);
  check("Japanese only: the episode translated before it plays, one request, English with each line on time");
  await b.close();

  // 3. Netflix as it is now: track URL only from the player, player clock ahead of the element's.
  const before = batches.length;
  const c = await ctx.newPage();
  await c.goto("https://www.netflix.com/watch/333");
  await record(c);
  const reportC = await watch(c, "Player API + ad-shifted clock", join(artifacts, "player-clock.png"));
  console.log("   Player API + clock 3 s ahead, per line (ms after cue start / after cue end):", JSON.stringify(reportC));
  assert.deepEqual(await c.evaluate(() => window.__trackCalls), ["T-ja", "T-off"], "Japanese selected for its URL, then the learner's choice put back");
  assert.equal(batches.length, before + 1, "translated ahead from the player's track");
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.netflix.com/watch/333" }))[0].id);
  const diag = (await sw.evaluate((tabId) => chrome.tabs.sendMessage(tabId, { type: "avc-subs-diag" }), tabId)).diag;
  assert.equal(diag.source, "track");
  assert.equal(diag.offsetMs, OFFSET * 1000);
  assert.ok(diag.pageChecked >= LINES.length && diag.pageMatched === diag.pageChecked, "Netflix's own line matched ours every time: " + JSON.stringify(diag));
  check("Netflix today: track from the player API, timed on the player's clock (3 s ahead of the element), matching Netflix's own line every time");
} finally {
  await ctx.close(); await new Promise((r) => server.close(r)); await rm(temp, { recursive: true, force: true });
}
