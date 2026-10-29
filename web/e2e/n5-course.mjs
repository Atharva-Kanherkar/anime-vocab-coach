// Hermetic browser -> real Next gateway -> real workerd/KV/D1 pilot.
// Uses only synthetic identities; no model calls, remote credentials or cookies.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, request as apiRequest } from "playwright";
import { runtime } from "../../backend/test/runtime.ts";
import { correctAnswers } from "../../backend/test/answers.ts";

const web = fileURLToPath(new URL("../", import.meta.url));
const backend = fileURLToPath(new URL("../../backend/", import.meta.url));
const artifacts = process.env.N5_ARTIFACTS || "/tmp/animevocab-n5-web";
await mkdir(artifacts, { recursive: true });
process.chdir(backend);
const app = await runtime({ allowed: "dev-user" });
process.chdir(web);
const port = await new Promise((resolve) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const base = `http://127.0.0.1:${port}`;
let child;
let logs = "";
const browser = await chromium.launch();
const probe = await apiRequest.newContext();
const exec = promisify(execFile);
async function curlProbe(path, expected, extra = []) {
  const { stdout } = await exec("curl", ["-sS", "--max-time", "30", "-o", "/dev/null", "-w", "%{http_code}", ...extra, base + path]);
  assert.equal(Number(stdout), expected);
}
const check = (name) => console.log(`PASS ${name}`);
async function start(enabled) {
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: web, env: { ...process.env, NODE_ENV: "development", NEXT_PUBLIC_AVC_DEV_NO_CLERK: "1", N5_WEB_PREVIEW_ENABLED: enabled ? "1" : "0", N5_API_ORIGIN: (await app.mf.ready).origin, OPENAI_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (b) => { logs += b; appendFileSync(`${artifacts}/next.log`, b); }); child.stderr.on("data", (b) => { logs += b; appendFileSync(`${artifacts}/next.log`, b); });
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error("Next exited: " + logs.slice(-4000));
    try { const response = await probe.get(base + "/api/n5/catalog", { timeout: 30000 }); if (response.status() !== 500) return; } catch (error) { console.log("Waiting for Next:", error.message.split("\n")[0]); }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Next readiness timeout: " + logs.slice(-4000));
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const done = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM");
  const timeout = setTimeout(() => child?.kill("SIGKILL"), 10000);
  await done; clearTimeout(timeout);
}
async function fill(page, script) {
  const answers = correctAnswers(script);
  const lesson = await page.evaluate(async () => (await fetch("/api/n5/lessons/your-lie-in-april-s1-e1")).json());
  for (const q of lesson.questions) {
    const answer = answers.find((a) => a.questionId === q.id);
    if (q.kind === "choice") await page.locator(`input[name="${q.id}"]`).nth(q.choices.findIndex((c) => c.id === answer.value)).check();
    else await page.locator(`#question-${q.id}`).fill(answer.value);
  }
  const text = (await page.locator("[data-owned-japanese]").allTextContents()).join("");
  assert.ok(text.length > 0);
  assert.ok(script === "romaji" ? !/[ぁ-ヿ一-龯]/u.test(text) : !/[A-Za-z一-龯]/u.test(text), `mixed ${script}: ${text}`);
}
try {
  await writeFile(`${artifacts}/next.log`, "");
  await start(true);
  check("Next gateway and real Worker started");
  const minted = await (await probe.post(base + "/api/sync/token")).json();
  assert.ok(typeof minted.token === "string" && minted.token.startsWith("avc_st_"));
  const token = minted.token;
  await app.kv.put(`synctoken:${token}:v1`, JSON.stringify({ id: "dev-user", name: "Dev Learner", email: null, plan: "free", touchedAt: Date.now() }));
  const diagnostic = await probe.post(base + "/api/n5/enrolments", { headers: { Origin: base }, data: { trackId: "your-lie-in-april-2014", script: "romaji", idempotencyKey: "gateway-preflight" } });
  check("same-origin authenticated mutation preflight");
  assert.equal(diagnostic.status(), 200);
  await curlProbe("/api/n5/catalog", 200);
  await curlProbe("/api/n5/catalog", 401, ["-H", "Authorization: Bearer attacker"]);
  await curlProbe("/api/n5/events", 403, ["-X", "POST", "-H", "Origin: https://evil.test", "-H", "Content-Type: application/json", "--data", "{}"]);
  await curlProbe("/api/n5/catalog?upstream=https://evil.test", 404);
  check("curl authentication, CSRF and open-proxy boundaries");
  const responses = [];
  for (const script of ["romaji", "kana"]) {
    await app.db.prepare("DELETE FROM n5_accounts").run();
    const context = await browser.newContext({ viewport: script === "kana" ? { width: 390, height: 844 } : { width: 1280, height: 960 } });
    await context.addInitScript(() => {
      window.__micCalls = 0;
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__micCalls++; throw new Error("No mic in N5 preview"); };
    });
    const page = await context.newPage(); page.setDefaultNavigationTimeout(120000);
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", async (r) => { if (r.url().includes("/api/n5/") && r.headers()["content-type"]?.includes("application/json")) try { responses.push(await r.text()); } catch {} });
    await page.goto(base + "/app/n5");
    await page.getByRole("heading", { name: "Your Japanese starts here." }).waitFor();
    assert.equal(await page.getByText("Planned · not available", { exact: true }).count(), 5);
    await page.getByRole("radio", { name: script === "kana" ? /Kana/ : /Romaji/ }).focus();
    await page.keyboard.press("Space");
    assert.ok(await page.getByRole("radio", { name: script === "kana" ? /Kana/ : /Romaji/ }).isChecked());
    await page.getByRole("button", { name: "Start the private pilot" }).click();
    await page.getByRole("heading", { name: "Meet someone new." }).waitFor();
    assert.equal(await page.getByText("Episode recap", { exact: true }).count(), 0);
    assert.match(await page.getByRole("link", { name: "Open Crunchyroll series" }).getAttribute("href"), /^https:\/\/www.crunchyroll.com\/series\//);
    await page.screenshot({ path: `${artifacts}/lesson-${script}.png`, fullPage: true });
    await page.getByRole("button", { name: "I watched episode 1" }).click();
    await page.getByText("Episode recap", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Begin episode practice" }).click();
    await page.getByRole("heading", { name: "Make the words yours." }).waitFor();
    const id = new URL(page.url()).pathname.split("/").pop();
    await fill(page, script);
    if (script === "kana") {
      await page.locator("#question-write-name").fill("Haruです");
      await page.getByRole("button", { name: "Save progress" }).click();
      await page.getByRole("alert").filter({ hasText: "highlighted question" }).waitFor();
      await page.waitForFunction(() => document.activeElement?.id === "question-write-name");
      await fill(page, script);
    }
    await page.reload(); await page.getByRole("heading", { name: "Make the words yours." }).waitFor();
    assert.equal(await page.locator("#question-write-name").inputValue(), correctAnswers(script).find((a) => a.questionId === "write-name").value);
    if (script === "romaji") {
      // A second authenticated writer advances the real server revision.
      assert.equal((await app.request(`/attempts/${id}/answers`, { token, body: { revision: 0, idempotencyKey: "other-writer", answers: [{ questionId: "greeting", value: "a" }] } })).status, 200);
      await page.getByRole("button", { name: "Save progress" }).click();
      await page.getByRole("alert").filter({ hasText: "newer version" }).waitFor();
      assert.equal((await (await app.request(`/attempts/${id}`, { token })).json()).revision, 1);
      assert.ok(await page.locator("#question-write-name").inputValue());
      await page.getByRole("button", { name: "Use server answers instead of this draft" }).click();
      await page.getByRole("heading", { name: "Make the words yours." }).waitFor(); await fill(page, script);
      const payloads = [];
      await page.route("**/api/n5/attempts/*/answers", async (route) => {
        payloads.push(route.request().postData());
        if (payloads.length === 1) { await route.fetch(); await route.abort("failed"); } else await route.continue();
      });
      await page.getByRole("button", { name: "Save progress" }).click();
      await page.getByRole("button", { name: "Retry saving answers" }).waitFor();
      await page.getByRole("button", { name: "Retry saving answers" }).click();
      await page.getByRole("status").filter({ hasText: "Saved to your account" }).waitFor();
      assert.equal(payloads.length, 2); assert.equal(payloads[0], payloads[1]);
      await page.unroute("**/api/n5/attempts/*/answers");
      check("real revision conflict preserves draft; lost response replays identical receipt");
    } else {
      await page.route("**/api/n5/**", (route) => route.abort("internetdisconnected"));
      await page.reload(); await page.getByRole("alert").filter({ hasText: "Connection unavailable" }).waitFor();
      await page.unroute("**/api/n5/**"); await page.reload(); await page.getByRole("heading", { name: "Make the words yours." }).waitFor();
      assert.equal(await page.locator("#question-write-name").inputValue(), correctAnswers(script).find((a) => a.questionId === "write-name").value);
      check("unsaved kana draft survives offline API failure and refresh");
    }
    await page.screenshot({ path: `${artifacts}/quiz-${script}.png`, fullPage: true });
    const viewport = page.viewportSize();
    await page.setViewportSize(script === "kana" ? { width: 1280, height: 960 } : { width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${artifacts}/quiz-${script}-alternate.png`, fullPage: true });
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole("button", { name: "Finish objective practice" }).click();
    await page.getByRole("heading", { name: "A first conversation starts here." }).waitFor();
    await page.waitForURL("**/results/*");
    assert.match(await page.locator(".n5-score").innerText(), /8\s*\/\s*8/);
    assert.match(await page.locator("body").innerText(), /Not assessed/);
    const result = await (await app.request(`/attempts/${id}`, { token })).json();
    assert.equal(result.result.mastery, false); assert.equal(result.result.production, "needs_review");
    assert.equal((await app.db.prepare("SELECT COUNT(*) AS n FROM n5_review_events").first()).n, 8);
    await page.reload(); await page.getByRole("heading", { name: "A first conversation starts here." }).waitFor();
    assert.equal(await page.evaluate(() => window.__micCalls), 0);
    assert.ok(!(await page.evaluate(() => JSON.stringify(sessionStorage))).includes("avc_st_"));
    await page.screenshot({ path: `${artifacts}/result-${script}.png`, fullPage: true });
    if (script === "kana") {
      const stale = await (await app.request("/attempts", { token, body: { lessonId: "your-lie-in-april-s1-e1", contentVersion: "preview-1", idempotencyKey: "stale-browser" } })).json();
      await app.db.prepare("UPDATE n5_attempts SET pack_hash='retired' WHERE id=?").bind(stale.id).run();
      await page.goto(base + `/app/n5/attempts/${stale.id}`); await page.getByRole("heading", { name: "Make the words yours." }).waitFor(); await fill(page, script);
      await page.getByRole("button", { name: "Save progress" }).click(); await page.getByRole("alert").filter({ hasText: "retired lesson" }).waitFor();
      await page.getByRole("button", { name: "Discard this unfinished attempt" }).click(); await page.getByRole("heading", { name: "Meet someone new." }).waitFor();
      assert.equal((await app.request(`/attempts/${stale.id}`, { token })).status, 404);
      assert.equal((await app.request(`/attempts/${id}`, { token })).status, 200);
      check("stale content can be discarded without deleting completed history");
    }
    await page.route("**/api/n5/**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "unauthorized" } }) }));
    await page.goto(base + `/app/n5/attempts/${id}`); await page.getByRole("heading", { name: "Sign in again", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("avc:n5:")).length), 0);
    assert.deepEqual(errors, []); await context.close(); check(`${script} full browser/Worker journey, layout, resume, privacy and auth loss`);
  }
  assert.ok(!responses.join("").includes("correctOption")); assert.ok(!responses.join("").includes("avc_st_"));
  await stop(); await start(false);
  assert.equal((await probe.get(base + "/api/n5/catalog")).status(), 404);
  assert.equal((await probe.get(base + "/app/n5")).status(), 404);
  await curlProbe("/api/n5/catalog", 404);
  await curlProbe("/app/n5", 404);
  check("default-off page and API unavailable; no secrets or grading keys reach browser");
} catch (error) { await writeFile(`${artifacts}/next.log`, logs); throw error; }
finally { await stop(); await probe.dispose(); await browser.close(); await app.mf.dispose(); await writeFile(`${artifacts}/next.log`, logs); }
