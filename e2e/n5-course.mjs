// Actual unpacked extension -> local HTTPS provider -> real Worker/KV/D1.
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
const hosted = [], deliveries = [];
const videoPage = `<!doctype html><html><head><title>Episode one - YouTube</title></head><body><div id="movie_player"><video class="html5-main-video" muted width="640" height="360"></video><div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div></div><script>const v=document.querySelector('video'),c=document.createElement('canvas');c.width=640;c.height=360;const g=c.getContext('2d');setInterval(()=>{g.fillStyle='#192e32';g.fillRect(0,0,640,360)},100);v.srcObject=c.captureStream(10);v.play();window.playVideo=()=>v.play();</script></body></html>`;
const server = createServer({ key: await readFile(join(temp, "key.pem")), cert: await readFile(join(temp, "cert.pem")) }, async (req, res) => {
  try {
    const host = req.headers.host?.split(":")[0];
    if (host === "www.youtube.com") { res.writeHead(200, { "Content-Type": "text/html" }).end(videoPage); return; }
    if (host === "api.animevocab.com" && req.url.startsWith("/v1/n5")) {
      if (offline) { res.destroy(); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString();
      if (req.url === "/v1/n5/events") deliveries.push(JSON.parse(body));
      const response = await app.mf.dispatchFetch("http://localhost" + req.url, { method: req.method, headers: req.headers, ...(body ? { body } : {}) });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    if (req.url.startsWith("/app/n5")) { hosted.push(req.url); res.writeHead(200, { "Content-Type": "text/html" }).end("<!doctype html><title>Hosted N5 practice destination</title><h1>Practice destination</h1>"); return; }
    if (req.url.startsWith("/api/sync/token")) { res.writeHead(401, { "Content-Type": "application/json" }).end('{"error":"synthetic session only"}'); return; }
    res.writeHead(204).end();
  } catch { res.writeHead(500).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ctx = await chromium.launchPersistentContext("", { channel: "chromium", headless: !process.env.AVC_E2E_HEADED, args: [`--disable-extensions-except=${resolve("extension")}`, `--load-extension=${resolve("extension")}`, `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${port},MAP api.animevocab.com 127.0.0.1:${port},MAP www.youtube.com 127.0.0.1:${port}`, "--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"] });
const check = name => console.log("PASS " + name);
let sw;
try {
  sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const id = new URL(sw.url()).host;
  await sw.evaluate(async () => { for(let i=0;i<100;i++){const s=await chrome.storage.local.get(["settings","onboarding"]);if(s.settings && s.onboarding?.installedAt) return; await new Promise(r=>setTimeout(r,50));} throw new Error("Install did not settle"); });
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_n5local", syncProfile: { name: "Learner", plan: "free" }, settings: { pauseMode: "off", displayScript: "romaji-kana", learningDirection: "ja-en", subLens: false }, vocab: { hello: { state: "known" } } }));
  const baseline = await sw.evaluate(() => chrome.storage.local.get(["settings", "vocab"]));
  const video = await ctx.newPage(); await video.goto("https://www.youtube.com/watch?v=episode1");
  await video.locator("video").waitFor();
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "https://www.youtube.com/watch?v=episode1" }))[0].id);
  const popup = await ctx.newPage(); await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  assert.ok(await popup.getByRole("button", { name: "N5 Course · private pilot" }).isVisible()); await popup.close();
  const page = await ctx.newPage(); page.setDefaultTimeout(20000);
  const openCourse = () => page.goto(`chrome-extension://${id}/course/course.html?tabId=${tabId}`);
  await openCourse();
  await page.getByText("Course connected.", { exact: false }).waitFor();
  await page.getByRole("radio", { name: "Romaji", exact: true }).check();
  await page.getByRole("button", { name: "Use this script" }).click();
  await page.getByRole("heading", { name: "Greet a new classmate and introduce yourself politely." }).waitFor();
  await page.locator("#confirmed").check();
  await page.getByRole("button", { name: "Show lesson beside this video" }).click();
  await page.locator("#error").filter({ hasText: "Confirm Japanese" }).waitFor();
  await page.locator("#japanese").check();
  await page.getByRole("button", { name: "Show lesson beside this video" }).click();
  await video.locator("#avc-n5-focus").waitFor();
  const panel = video.locator("#avc-n5-focus");
  await panel.locator("summary").click();
  const readings = (await panel.locator("[data-n5-japanese]").allTextContents()).join(" ");
  assert.ok(readings.includes("tomodachi")); assert.ok(!/[ぁ-ヿ一-龯]/.test(readings));
  assert.deepEqual(await sw.evaluate(() => chrome.storage.local.get(["settings", "vocab"])), baseline);
  await video.screenshot({ path: join(artifacts, "focus-romaji.png") });
  check("actual popup/course/focus UI preserves English deck and general settings, with pure romaji targets");
  // A player that refuses pause must prevent tab opening and watch recording.
  await video.evaluate(() => document.querySelector("video").play());
  await sw.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:()=>{document.querySelector("video").pause=()=>{};}}), tabId);
  const before = hosted.length;
  await panel.getByRole("button", { name: "Finish episode and practise" }).click();
  await panel.locator("output").filter({ hasText: "could not be paused" }).waitFor();
  assert.equal(hosted.length, before);
  await sw.evaluate(async tabId => chrome.scripting.executeScript({target:{tabId},func:()=>{delete document.querySelector("video").pause;}}), tabId);
  check("missing player pause acknowledgement fails closed");
  // Actual offscreen document acknowledges track stop; no provider/model session is started.
  await sw.evaluate(async () => { if (!await chrome.offscreen.hasDocument()) await chrome.offscreen.createDocument({ url: "offscreen/offscreen.html", reasons: [chrome.offscreen.Reason.USER_MEDIA], justification: "Local handoff acknowledgement test" }); });
  await new Promise(r => setTimeout(r, 400));
  // A missing offscreen acknowledgement must fail closed as well.
  await sw.evaluate(() => { globalThis.originalN5Send = chrome.runtime.sendMessage; chrome.runtime.sendMessage = function(message, ...rest) { if (message?.type === "avc-offscreen-stop") return Promise.resolve({ok:false}); return globalThis.originalN5Send.call(this,message,...rest); }; });
  await panel.getByRole("button", { name: "Finish episode and practise" }).click();
  await panel.locator("output").filter({ hasText: "Audio capture could not be stopped" }).waitFor();
  assert.equal(hosted.length, before);
  assert.equal((await sw.evaluate(() => chrome.storage.local.get("n5Pilot:n5-local-user")))["n5Pilot:n5-local-user"].queue.length, 0);
  await sw.evaluate(() => { chrome.runtime.sendMessage=globalThis.originalN5Send; delete globalThis.originalN5Send; });
  check("capture-stop acknowledgement failure prevents watch recording and hosted handoff");
  // Hold a real background Listening start before stream acquisition. Handoff
  // must cancel it, so its eventual browser result cannot reactivate capture.
  await sw.evaluate(() => { globalThis.originalN5Capture=chrome.tabCapture.getMediaStreamId; chrome.tabCapture.getMediaStreamId=()=>new Promise(resolve=>{globalThis.releaseN5Capture=resolve;}); });
  await page.evaluate(tabId => { window.pendingN5Start=chrome.runtime.sendMessage({type:"avc-listen-start",tabId}); },tabId);
  await sw.evaluate(async () => { for(let i=0;i<100;i++){if(globalThis.releaseN5Capture)return;await new Promise(r=>setTimeout(r,50));}throw new Error("Pending capture not reached"); });
  offline = true;
  await panel.getByRole("button", { name: "Finish episode and practise" }).click();
  await panel.locator("output").filter({ hasText: "Practice opened" }).waitFor();
  assert.equal(await video.locator("video").evaluate(v => v.paused), true);
  await page.waitForTimeout(300);
  assert.ok(hosted.some(p => p === "/app/n5/lessons/your-lie-in-april-s1-e1?script=romaji"));
  const cache = await sw.evaluate(() => chrome.storage.local.get("n5Pilot:n5-local-user"));
  assert.equal(cache["n5Pilot:n5-local-user"].queue.length, 1);
  const eventKey = cache["n5Pilot:n5-local-user"].queue[0].idempotencyKey;
  assert.equal(JSON.stringify(await video.locator("body").innerText()).includes("avc_st_"), false);
  await sw.evaluate(() => { globalThis.releaseN5Capture("late-test-stream"); chrome.tabCapture.getMediaStreamId=globalThis.originalN5Capture; delete globalThis.originalN5Capture; delete globalThis.releaseN5Capture; });
  assert.equal((await page.evaluate(()=>window.pendingN5Start)).ok,false);
  assert.equal((await page.evaluate(tabId=>chrome.runtime.sendMessage({type:"avc-listen-status",tabId}),tabId)).listening,false);
  check("real offscreen acknowledgement precedes handoff; pending capture start stays cancelled and offline observation is durable");
  // Stop the service worker, retaining Chrome session/local storage, then wake it through the UI.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("ServiceWorker.enable"); await cdp.send("ServiceWorker.stopAllWorkers"); await cdp.detach();
  offline = false;
  await page.getByRole("button", { name: "Refresh / retry pending sync" }).click();
  await page.locator("#status").filter({ hasText: "Course connected" }).waitFor();
  sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  await page.waitForFunction(() => document.querySelector("#status").textContent.includes("Course connected"));
  assert.ok(deliveries.some(d => d.idempotencyKey === eventKey));
  assert.equal((await (await app.request("/me/progress")).json()).observations.length, 1);
  check("worker restart replays the original durable watch receipt once");
  await page.getByRole("radio", { name: "Kana", exact: true }).check();
  await page.getByRole("button", { name: "Use this script" }).click();
  await page.waitForFunction(() => document.querySelector("#words")?.textContent.includes("ともだち"));
  await page.getByRole("button", { name: "Show lesson beside this video" }).click();
  await video.locator("#avc-n5-focus").waitFor();
  await video.locator("#avc-n5-focus summary").click();
  const kana = (await video.locator("#avc-n5-focus [data-n5-japanese]").allTextContents()).join("");
  assert.ok(kana.includes("ともだち")); assert.ok(!/[A-Za-z一-龯]/.test(kana));
  await video.screenshot({ path: join(artifacts, "focus-kana.png") });
  await video.evaluate(() => history.pushState({}, "", "/watch?v=episode2"));
  await video.locator("#avc-n5-focus").waitFor({ state: "detached" });
  assert.deepEqual(await sw.evaluate(() => chrome.storage.local.get(["settings", "vocab"])), baseline);
  check("pure kana focus and SPA episode invalidation restore normal watching without changing settings");
  // A fresh tab whose Copilot was never user-closed must still auto-card
  // after entering and exiting focus; course suspension is not a user close.
  await sw.evaluate(() => chrome.storage.local.set({settings:{pauseMode:"copilot",displayScript:"romaji-kana",learningDirection:"en-ja",subLens:true,autoSpeak:false,cooldownSec:0,maxCardsPerHour:99}}));
  await video.goto("https://www.youtube.com/watch?v=episode1");
  await video.waitForTimeout(1000);
  await page.getByRole("button", {name:"Show lesson beside this video"}).click();
  await video.locator("#avc-n5-focus").waitFor();
  await video.evaluate(()=>{document.querySelector(".ytp-caption-segment").textContent="父はまだ帰らない。";});
  await video.waitForTimeout(1000);
  assert.equal(await video.locator("#avc-overlay-host").count(),0);
  await video.getByRole("button",{name:"Exit course focus"}).click();
  await video.locator("#avc-n5-focus").waitFor({state:"detached"});
  await video.waitForTimeout(5000);
  let carded=false;
  for(const line of ["約束を守ると言った。","電車が遅れている。","明日は雨が降るそうだ。","猫が窓の外を見ている。"]){
    await video.evaluate(line=>{document.querySelector(".ytp-caption-segment").textContent=line;},line);
    carded=await video.locator("#avc-overlay-host .avc-agent-word-block.avc-active").waitFor({timeout:5000}).then(()=>true,()=>false);if(carded)break;
  }
  assert.equal(carded,true,"normal automatic cards must resume after course focus");
  await sw.evaluate(baseline=>chrome.storage.local.set(baseline),baseline);
  check("course focus suppresses live overlays and restores ordinary automatic cards on exit");
  // A different verified identity cannot replay the old owner's cache/outbox.
  await sw.evaluate(() => chrome.storage.local.set({ syncToken: "avc_st_n5other" }));
  await page.locator("#status").filter({ hasText: "Account changed" }).waitFor();
  await page.getByRole("button", { name: "Refresh / retry pending sync" }).click();
  await page.locator("#status").filter({ hasText: "Course connected" }).waitFor();
  await page.locator("#lesson").waitFor({ state: "hidden" });
  assert.equal((await (await app.request("/me/progress", { token: "avc_st_n5other" })).json()).observations.length, 0);
  check("account switching hides prior course content and isolates observation ownership");
  await page.screenshot({ path: join(artifacts, "account-switch.png"), fullPage: true });
} finally {
  await ctx.close(); await new Promise(r => server.close(r)); await app.mf.dispose(); await rm(temp, { recursive: true, force: true });
}
