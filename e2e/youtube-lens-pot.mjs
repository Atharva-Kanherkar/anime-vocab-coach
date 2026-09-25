// E2E: the Subtitle Lens works on YouTube with Listening Mode off.
//
// YouTube serves caption tracks as an empty body unless the request carries
// the player's proof-of-origin token (`pot`). This fake watch page does the
// same: /api/timedtext answers empty without `pot=`, and the fake player only
// sends the token when captions are switched on, the way the real one does.
// Captions start off. The extension has to get the player to mint the token,
// load the Japanese auto-generated track with it, switch captions back off,
// and mirror each sentence in the Lens while it is being spoken.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

// Auto-generated json3: word events inside rolling windows, plus the "\n"
// append events that scroll them. Two sentences, a pause between them.
const S1 = ["今日", "は", "本当", "に", "いい", "天気", "です", "ね。"];
const S2 = ["明日", "も", "一緒", "に", "学校", "へ", "行こう", "よ。"];
const words = (list, t0) => list.map((w, i) => ({ utf8: w, tOffsetMs: i * 250, _t0: t0 }));
const ASR_JSON3 = {
  events: [
    { tStartMs: 0, dDurMs: 20000, id: 1, wpWinPosId: 1, wsWinStyleId: 1 },
    { tStartMs: 2000, dDurMs: 5000, wWinId: 1, segs: words(S1.slice(0, 4), 2000).map(({ _t0, ...s }) => s) },
    { tStartMs: 3000, dDurMs: 4000, wWinId: 1, segs: words(S1.slice(4), 3000).map(({ _t0, ...s }) => s) },
    { tStartMs: 4500, wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] },
    { tStartMs: 7000, dDurMs: 5000, wWinId: 1, segs: words(S2.slice(0, 4), 7000).map(({ _t0, ...s }) => s) },
    { tStartMs: 8000, dDurMs: 4000, wWinId: 1, segs: words(S2.slice(4), 8000).map(({ _t0, ...s }) => s) },
  ],
};

const watchPage = (videoId) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${videoId} - YouTube</title></head><body style="margin:0;background:#0f0f0f;color:#eee">
<div id="movie_player" style="position:relative;width:960px;height:540px;margin:24px">
  <video class="html5-main-video" width="960" height="540" muted style="background:#000"></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
</div>
<script>
  const v = document.querySelector("video");
  const c = document.createElement("canvas");
  c.width = 960; c.height = 540;
  const g = c.getContext("2d");
  let f = 0;
  setInterval(() => {
    f++;
    const grd = g.createLinearGradient(0, 0, 960, 540);
    grd.addColorStop(0, "#1d2b4a"); grd.addColorStop(1, "#4a2b3d");
    g.fillStyle = grd; g.fillRect(0, 0, 960, 540);
    g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.arc(480 + Math.sin(f / 20) * 200, 220, 120, 0, 7); g.fill();
  }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  let subs = false;
  window.__toggles = 0;
  const player = document.getElementById("movie_player");
  const base = "/api/timedtext?v=${videoId}&exp=xpe&signature=SIG&kind=asr&lang=ja";
  player.getPlayerResponse = () => ({
    videoDetails: { videoId: "${videoId}" },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [
      { baseUrl: base, languageCode: "ja", kind: "asr" },
    ] } },
  });
  player.isSubtitlesOn = () => subs;
  player.toggleSubtitles = () => {
    subs = !subs;
    window.__toggles++;
    if (subs) fetch(base + "&fmt=json3&c=WEB&cver=2.1&pot=TEST_POT").catch(() => {});
  };
</script></body></html>`;

const LENS_TEXT = () => {
  const host = document.querySelector("[data-avc-sub-lens]");
  const lens = host?.shadowRoot?.querySelector(".lens.on .line.jp");
  return lens ? lens.textContent : "";
};

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  viewport: { width: 1040, height: 640 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));
  const SETTINGS = { pauseMode: "off", subLens: true, subLensPeek: false, learningDirection: "en-ja", targetLevel: 5 };
  let seeded = false;
  for (let i = 0; i < 12 && !seeded; i++) {
    await sw.evaluate((s) => chrome.storage.local.set({ settings: s, vocab: {}, stats: { daily: {}, cardTimestamps: [] } }), SETTINGS);
    await new Promise((r) => setTimeout(r, 250));
    const got = await sw.evaluate(async () => (await chrome.storage.local.get("settings")).settings);
    seeded = !!got && got.subLens === true && got.pauseMode === "off";
  }
  check("test settings applied (Lens on, cards off)", seeded);

  const timedtext = { withPot: 0, withoutPot: 0 };
  await ctx.route("https://www.youtube.com/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/timedtext") {
      if (url.searchParams.get("pot")) {
        timedtext.withPot++;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ASR_JSON3) });
      }
      timedtext.withoutPot++;
      return route.fulfill({ status: 200, contentType: "application/json", body: "" });
    }
    const id = url.searchParams.get("v") || "vidPOT";
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: watchPage(id) });
  });

  const page = await ctx.newPage();
  page.on("console", (m) => { if (process.env.AVC_E2E_VERBOSE) console.log("   [page]", m.text()); });
  await page.goto("https://www.youtube.com/watch?v=vidPOT", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.querySelector("video").paused, null, { timeout: 15000 });

  // Sentence 1 is spoken from 2.0s to ~4.2s of video time, sentence 2 from 7.0s.
  const seen = new Map();
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const [t, text] = await page.evaluate((fn) => [document.querySelector("video").currentTime, eval(fn)()], `(${LENS_TEXT})`);
    if (text && !seen.has(text)) seen.set(text, t);
    if (seen.size >= 2 && t > 9.5) break;
    await page.waitForTimeout(100);
  }
  const s1 = S1.join(""), s2 = S2.join("");
  // Shots of the Lens on sentence 2 while it is still up, then of a word tip.
  await page.screenshot({ path: `${SHOTS}/lens-pot.png`, clip: { x: 0, y: 0, width: 1010, height: 590 } });
  const tokBox = await page.evaluate(() => {
    const tok = document.querySelector("[data-avc-sub-lens]")?.shadowRoot?.querySelectorAll(".tok")[2];
    const r = tok?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  });
  if (tokBox) {
    await page.mouse.move(tokBox.x, tokBox.y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOTS}/lens-pot-tip.png`, clip: { x: 0, y: 0, width: 1010, height: 590 } });
  }

  check("the track was fetched with the player's token", timedtext.withPot >= 1, JSON.stringify(timedtext));
  check("Listening Mode was never started", !(await sw.evaluate(async () => {
    const r = await chrome.storage.session?.get?.(null).catch(() => ({}));
    return JSON.stringify(r || {}).includes('"listening":true');
  })));
  const t1 = seen.get(s1), t2 = seen.get(s2);
  check("the Lens showed sentence 1 whole, while it was spoken", t1 !== undefined && t1 >= 1.9 && t1 < 4.5, `at ${t1?.toFixed?.(2)}s`);
  check("the Lens showed sentence 2 whole, while it was spoken", t2 !== undefined && t2 >= 6.9 && t2 < 9.5, `at ${t2?.toFixed?.(2)}s`);
  const fragments = [...seen.keys()].filter((k) => k !== s1 && k !== s2);
  check("no fragments of a sentence were mirrored", fragments.length === 0, JSON.stringify(fragments));
  check(
    "captions went back off after priming",
    await page.evaluate(() => !document.getElementById("movie_player").isSubtitlesOn() && window.__toggles === 2),
    `toggles=${await page.evaluate(() => window.__toggles)}`
  );
  const toast = await page.evaluate(() => {
    const host = document.querySelector("#avc-overlay-host");
    return (host?.shadowRoot || host)?.textContent || document.body.innerText;
  });
  check("no 'No Japanese captions' notice", !/No Japanese captions/.test(toast || ""));
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
