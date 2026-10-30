// Actual unpacked extension -> local HTTPS provider -> real Worker/KV/D1.
// Listening Mode following an N5 lesson: the lesson comes from the account,
// heard lesson words and a finished episode go back to it, and the copilot
// answers inside the unit.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:https";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runtime } from "../backend/test/runtime.ts";
const app = await runtime();
const artifacts = process.env.N5_EXTENSION_ARTIFACTS || "/tmp/animevocab-n5-extension";
await mkdir(artifacts, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "n5-extension-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(temp, "key.pem"), "-out", join(temp, "cert.pem"), "-days", "1", "-subj", "/CN=avc-test"], { stdio: "ignore" });
let offline = false;
const hosted = [], coach = [];
const videoPage = `<!doctype html><html><head><title>Your Lie in April - YouTube</title></head><body><div id="movie_player"><video class="html5-main-video" muted width="640" height="360"></video><div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div></div><script>const v=document.querySelector('video'),c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d');setInterval(()=>{g.fillStyle='#192e32';g.fillRect(0,0,640,360)},100);v.srcObject=c.captureStream(10);v.play();</script></body></html>`;
// The course pages announce themselves to the extension, as web/src/components/n5/common.tsx does.
const coursePage = `<!doctype html><title>N5 course</title><h1>Course</h1><script>setTimeout(()=>window.postMessage({source:"avc-web",type:"avc-n5-course-changed"},location.origin),800)</script>`;
const server = createServer({ key: await readFile(join(temp, "key.pem")), cert: await readFile(join(temp, "cert.pem")) }, async (req, res) => {
  try {
    const host = req.headers.host?.split(":")[0];
    if (host === "www.youtube.com") { res.writeHead(200, { "Content-Type": "text/html" }).end(videoPage); return; }
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString();
    if (host === "api.animevocab.com" && req.url.startsWith("/v1/n5")) {
      if (offline) { res.destroy(); return; }
      const response = await app.mf.dispatchFetch("http://localhost" + req.url, { method: req.method, headers: req.headers, ...(body ? { body } : {}) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    if (req.url.startsWith("/api/ai/coach/stream")) {
      coach.push(JSON.parse(body));
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.end(`data: ${JSON.stringify({ delta: "**tomodachi** means friend. It is one of your unit 1 words." })}\n\ndata: {"done":true}\n\n`);
      return;
    }
    if (req.url.startsWith("/app/n5")) { hosted.push(req.url); res.writeHead(200, { "Content-Type": "text/html" }).end(coursePage); return; }
    if (req.url.startsWith("/api/sync/token")) { res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"synthetic session only"}'); return; }
    res.writeHead(204).end();
  } catch { res.writeHead(500).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ctx = await chromium.launchPersistentContext("", { channel: "chromium", headless: !process.env.AVC_E2E_HEADED, viewport: { width: 1280, height: 760 }, args: [`--disable-extensions-except=${resolve("extension")}`, `--load-extension=${resolve("extension")}`, `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${port},MAP api.animevocab.com 127.0.0.1:${port},MAP www.youtube.com 127.0.0.1:${port}`, "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"] });
const check = name => console.log("PASS " + name);
const LESSON = "your-lie-in-april-u01";
const heardOnServer = async (token) => (await (await app.request("/me/progress", { token })).json()).lessons.find(l => l.lessonId === LESSON).heard;
try {
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  await sw.evaluate(async () => { for(let i=0;i<100;i++){const s=await chrome.storage.local.get(["settings","onboarding"]);if(s.settings && s.onboarding?.installedAt) return; await new Promise(r=>setTimeout(r,50));} throw new Error("Install did not settle"); });
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_n5local", syncProfile: { name: "Learner", plan: "free" }, settings: { pauseMode: "off", displayScript: "romaji-kana", learningDirection: "en-ja", subLens: true } }));
  // Enrolment happens on animevocab.com.
  assert.equal((await app.request("/enrolments", { body: { trackId: "your-lie-in-april-2014", script: "romaji", idempotencyKey: "enrol-romaji" } })).status, 200);

  const video = await ctx.newPage(); video.setDefaultTimeout(20000);
  await video.goto("https://www.youtube.com/watch?v=episode1");
  await video.locator("video").waitFor();
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.youtube.com/watch?v=episode1" }))[0].id);

  const popup = await ctx.newPage(); await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.locator("#n5-course").waitFor();
  assert.equal(await popup.locator("#n5-course-title").textContent(), "N5 · Unit 1 · Episode 1");
  assert.equal(await popup.locator("#study-session-btn").textContent(), "Start Listening");
  assert.equal(await popup.locator("#mode-lens-row").isHidden(), true);
  assert.equal(await popup.locator(".av-more").evaluate(d => d.open), false);
  await popup.screenshot({ path: join(artifacts, "popup-course.png"), fullPage: true });
  assert.equal(await popup.getByText("N5 Course · private pilot").count(), 0);
  check("popup: one Listening button, the lesson it follows, no Lens or course-focus switches");

  // Open the copilot the way Start Listening does, then hear the episode.
  await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: "avc-agent-show", tabId }), tabId);
  const panel = video.locator("#avc-overlay-host .avc-course");
  await panel.waitFor();
  const chips = (await panel.locator(".avc-course-word").allTextContents()).join(" ");
  assert.ok(chips.includes("tomodachi") && chips.includes("hajimemashite"));
  assert.ok(!/[ぁ-ヿ一-龯]/.test(chips), "romaji course shows romaji only");
  check("copilot shows the account's lesson in the learner's script");

  const hear = (text) => sw.evaluate(({ tabId, text }) => chrome.tabs.sendMessage(tabId, { type: "avc-transcript", text }), { tabId, text });
  await hear("はじめまして。友達だよ。");
  await panel.locator(".avc-course-word.avc-heard", { hasText: "tomodachi" }).waitFor();
  await panel.locator(".avc-course-word.avc-heard", { hasText: "hajimemashite" }).waitFor();
  await panel.locator(".avc-course-moment").waitFor();
  assert.equal(await video.locator("[data-avc-sub-lens]").count(), 0, "no Lens while following a lesson");
  await video.waitForFunction(async () => true);
  for (let i = 0; i < 50 && (await heardOnServer()).length < 2; i++) await video.waitForTimeout(100);
  assert.deepEqual((await heardOnServer()).sort(), ["hajimemashite", "tomodachi"]);
  await video.screenshot({ path: join(artifacts, "listening-heard.png") });
  check("heard lesson words light up and are saved to the account");

  await panel.getByRole("button", { name: "Explain this line" }).first().click();
  await video.locator("#avc-overlay-host .avc-agent-chat-log").getByText("one of your unit 1 words").waitFor();
  const asked = coach.at(-1);
  assert.equal(asked.mode, "chat");
  assert.deepEqual({ unit: asked.course.unit, script: asked.course.script }, { unit: 1, script: "romaji" });
  assert.ok(asked.course.words.some(w => w.startsWith("tomodachi")));
  assert.ok(asked.line.includes("友達"));
  check("the copilot is asked inside the unit (course prompt carries unit, script and words)");

  // Offline: heard words wait in the outbox and arrive later.
  offline = true;
  await hear("ピアノを弾いて。");
  await panel.locator(".avc-course-word.avc-heard", { hasText: "piano" }).waitFor();
  await video.waitForTimeout(500);
  assert.ok(!(await heardOnServer()).includes("piano"));
  offline = false;
  await sw.evaluate(async () => { const { n5ListenOutbox } = await chrome.storage.local.get("n5ListenOutbox"); if (!Object.keys(n5ListenOutbox.heard).length) throw new Error("outbox empty"); });
  check("offline heard words are kept for later");

  // Finish: pause, stop listening, record the episode, open practice on the site.
  await panel.getByRole("button", { name: "Finish episode 1 · practise" }).click();
  await panel.locator(".avc-course-status").filter({ hasText: "Practice opened" }).waitFor();
  assert.equal(await video.locator("video").evaluate(v => v.paused), true);
  assert.ok(hosted.includes(`/app/n5/lessons/${LESSON}?script=romaji`));
  const progress = await (await app.request("/me/progress")).json();
  assert.ok(progress.observations.some(o => o.kind === "watch_complete"));
  assert.ok((await heardOnServer()).includes("piano"), "the outbox drained with the finish");
  assert.equal((await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: "avc-listen-status", tabId }), tabId)).listening, false);
  check("finishing the episode records it and opens practice on animevocab.com");

  // Switch script on the website; the course page tells the extension.
  assert.equal((await app.request("/enrolments", { body: { trackId: "your-lie-in-april-2014", script: "kana", idempotencyKey: "enrol-kana" } })).status, 200);
  const site = await ctx.newPage(); await site.goto("https://animevocab.com/app/n5");
  await sw.evaluate(async () => { for (let i = 0; i < 100; i++) { const { n5Listen } = await chrome.storage.local.get("n5Listen"); if (n5Listen?.lesson?.script === "kana") return; await new Promise(r => setTimeout(r, 50)); } throw new Error("course did not refresh"); });
  await site.close();
  await video.reload(); await video.locator("video").waitFor();
  await popup.evaluate(tabId => chrome.runtime.sendMessage({ type: "avc-agent-show", tabId }), tabId);
  await panel.waitFor();
  const kana = (await panel.locator(".avc-course-word").allTextContents()).join("");
  assert.ok(kana.includes("ともだち") && !/[A-Za-z一-龯]/.test(kana.replace(/✓/g, "")));
  await video.screenshot({ path: join(artifacts, "listening-kana.png") });
  check("a script change on animevocab.com reaches the extension");

  // Another account has no lesson here; an English learner follows none.
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_n5other" }));
  await panel.waitFor({ state: "hidden" });
  assert.deepEqual(await heardOnServer("avc_st_n5other"), []);
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_n5local" }));
  await panel.waitFor();
  await sw.evaluate(async () => { const { settings } = await chrome.storage.local.get("settings"); await chrome.storage.local.set({ settings: { ...settings, learningDirection: "ja-en" } }); });
  await panel.waitFor({ state: "hidden" });
  check("account switches and English learners never see another lesson");
} finally {
  await ctx.close(); await new Promise(r => server.close(r)); await app.mf.dispose(); await rm(temp, { recursive: true, force: true });
}
