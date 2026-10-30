// Hermetic browser -> real Next gateway -> real workerd/KV/D1 pilot.
// Uses only synthetic identities; no model calls, remote credentials or cookies.
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { createServer as httpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, request as apiRequest } from "playwright";
import { oracle, runtime } from "../../backend/test/runtime.ts";
const { correctAnswers } = await oracle();

const web = fileURLToPath(new URL("../", import.meta.url));
const artifacts = process.env.N5_ARTIFACTS || "/tmp/animevocab-n5-web";
await mkdir(artifacts, { recursive: true });
const app = await runtime({ allowed: "dev-user" });
process.chdir(web);
// Mirror production: both Workers bind the same KV. This loopback bridge only
// transports binding calls; real records, expiry, minting and auth are exercised.
const kvAuth = randomUUID();
const kvBridge = httpServer(async (req, res) => {
  try {
    if (req.method !== "POST" || req.headers.authorization !== `Bearer ${kvAuth}`) {
      res.writeHead(403).end(); return;
    }
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 1_048_576) throw new Error("Test body too large");
    }
    const { op, key, value, options } = JSON.parse(raw);
    const result = op === "get" ? { value: await app.kv.get(key) }
      : op === "put" ? (await app.kv.put(key, value, options), {}) : null;
    if (result === null) throw new Error("Unknown test operation");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve) => kvBridge.listen(0, "127.0.0.1", resolve));
const kvUrl = `http://127.0.0.1:${kvBridge.address().port}`;
const port = await new Promise((resolve) => {
  const s = createServer().listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const base = `http://127.0.0.1:${port}`;
let child;
let logs = "";
const browser = await chromium.launch();
const probe = await apiRequest.newContext({ timeout: 120000 });
const exec = promisify(execFile);
async function curlProbe(path, expected, extra = []) {
  const { stdout } = await exec("curl", [
    "-sS",
    "--max-time",
    "30",
    "-o",
    "/dev/null",
    "-w",
    "%{http_code}",
    ...extra,
    base + path,
  ]);
  assert.equal(Number(stdout), expected);
}
const check = (name) => console.log(`PASS ${name}`);
async function start(enabled, upstreamOrigin, members = "dev-user") {
  child = spawn(
    process.execPath,
    [
      "--import",
      fileURLToPath(new URL("./n5-kv-binding.mjs", import.meta.url)),
      "node_modules/next/dist/bin/next",
      "dev",
      ...(process.env.N5_E2E_WEBPACK === "1" ? ["--webpack"] : []),
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: web,
      env: {
        ...process.env,
        NODE_ENV: "development",
        N5_TEST_KV_URL: kvUrl,
        N5_TEST_KV_AUTH: kvAuth,
        NEXT_PUBLIC_AVC_DEV_NO_CLERK: "1",
        N5_WEB_PREVIEW_ENABLED: enabled ? "1" : "0",
        N5_PREVIEW_USERS: members,
        N5_API_ORIGIN: upstreamOrigin ?? (await app.mf.ready).origin,
        OPENAI_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (b) => {
    logs += b;
    appendFileSync(`${artifacts}/next.log`, b);
  });
  child.stderr.on("data", (b) => {
    logs += b;
    appendFileSync(`${artifacts}/next.log`, b);
  });
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    if (child.exitCode !== null)
      throw new Error("Next exited: " + logs.slice(-4000));
    try {
      const response = await probe.get(base + "/api/n5/catalog", {
        timeout: 30000,
      });
      if (response.status() !== 500) return;
    } catch (error) {
      console.log("Waiting for Next:", error.message.split("\n")[0]);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Next readiness timeout: " + logs.slice(-4000));
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const done = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  const timeout = setTimeout(() => child?.kill("SIGKILL"), 10000);
  await done;
  clearTimeout(timeout);
}
const LESSON = "your-lie-in-april-u01";
const lessonPath = `/app/n5/lessons/${LESSON}`;
const lessonReady = (page) => page.getByRole("navigation", { name: "Lesson steps" }).waitFor();
const practiceReady = (page) => page.getByText(/Unit 1 practice/).waitFor();
const resultsReady = async (page) => {
  await page.waitForURL("**/results/*");
  await page.getByRole("heading", { name: /Unit passed\.|Good practice/ }).waitFor();
};
const goQuestion = (page, n) => page.getByRole("button", { name: new RegExp(`^Question ${n}(,|$)`) }).click();
// The review screen saves any unsaved answers, like the old explicit save.
const save = (page) => page.locator(".n5-qnav button").last().click();
const W1 = 9;
async function fill(page, script) {
  const answers = correctAnswers(script);
  const lesson = await page.evaluate(async (id) => (await fetch(`/api/n5/lessons/${id}`)).json(), LESSON);
  const seen = [];
  for (const [index, q] of lesson.questions.entries()) {
    await goQuestion(page, index + 1);
    const answer = answers.find((a) => a.questionId === q.id);
    if (q.kind === "choice")
      await page.locator(`input[name="${q.id}"]`).nth(q.choices.findIndex((c) => c.id === answer.value)).check();
    else await page.locator(`#question-${q.id}`).fill(answer.value);
    seen.push(...(await page.locator("[data-owned-japanese]").allTextContents()));
  }
  const text = seen.join("");
  assert.ok(text.length > 0);
  assert.ok(script === "romaji" ? !/[ぁ-ヿ一-龯]/u.test(text) : !/[A-Za-z一-龯]/u.test(text), `mixed ${script}: ${text}`);
}
try {
  await writeFile(`${artifacts}/next.log`, "");
  await start(true, undefined, "");
  assert.equal((await probe.get(base + "/app/n5")).status(), 404);
  assert.equal((await probe.get(base + "/api/n5/catalog")).status(), 404);
  const uninvitedDashboard = await probe.get(base + "/app");
  assert.equal(uninvitedDashboard.status(), 200);
  assert.ok(!(await uninvitedDashboard.text()).includes("N5 course preview"));
  check(
    "web allowlist hides private entry and direct gateway for a non-member",
  );
  await stop();
  await start(true);
  check("Next gateway and real Worker started");
  // Direct secondary-writer fixture; the web course never requests this token.
  const token = "avc_st_n5browser";
  await app.kv.put(`synctoken:${token}:v1`, JSON.stringify({ id: "dev-user", email: null, name: null, plan: "free", touchedAt: Date.now() }));
  const diagnostic = await probe.post(base + "/api/n5/enrolments", {
    headers: { Origin: base },
    data: {
      trackId: "your-lie-in-april-2014",
      script: "romaji",
      idempotencyKey: "gateway-preflight",
    },
  });
  check("same-origin authenticated mutation preflight");
  assert.equal(diagnostic.status(), 200);
  await curlProbe("/api/n5/catalog", 200);
  await curlProbe("/api/n5/catalog", 401, [
    "-H",
    "Authorization: Bearer attacker",
  ]);
  await curlProbe("/api/n5/events", 403, [
    "-X",
    "POST",
    "-H",
    "Origin: https://evil.test",
    "-H",
    "Content-Type: application/json",
    "--data",
    "{}",
  ]);
  await curlProbe("/api/n5/catalog?upstream=https://evil.test", 404);
  check("curl authentication, CSRF and open-proxy boundaries");
  const courseToken = await app.kv.get("n5token:user:dev-user:v1");
  assert.match(courseToken, /^avc_n5_[a-f0-9]{64}$/);
  assert.deepEqual((await app.kv.list({ prefix: "synctoken:user:" })).keys, []);
  assert.equal((await probe.get(base + "/app/n5")).status(), 200);
  const dashboard = await probe.get(base + "/app");
  assert.equal(dashboard.status(), 200);
  assert.ok((await dashboard.text()).includes("N5 course preview"));
  const denied = await runtime({ allowed: "other-user" });
  try {
    await denied.kv.put(`n5token:${courseToken}:v1`, await app.kv.get(`n5token:${courseToken}:v1`));
    assert.equal((await denied.request("/catalog", { token: courseToken })).status, 404);
  } finally { await denied.mf.dispose(); }
  check("course-only credentials never link the extension; backend membership remains independent");
  // Script recovery exercises real commits with deliberately lost HTTP responses.
  const scriptContext = await browser.newContext();
  await scriptContext.addInitScript(() => localStorage.setItem("avc:n5:guide:v1", "seen"));
  const scriptPage = await scriptContext.newPage();
  scriptPage.setDefaultNavigationTimeout(120000);
  await scriptPage.goto(base + "/app/n5");
  await scriptPage.getByRole("button", { name: "Continue: Unit 1" }).waitFor();
  // Another authenticated tab changes the enrolment behind the open hub.
  await app.request("/enrolments", { token, body: { trackId: "your-lie-in-april-2014", script: "kana", idempotencyKey: "other-tab-enrolment" } });
  await scriptPage.getByRole("button", { name: "Continue: Unit 1" }).click();
  await lessonReady(scriptPage);
  assert.equal(new URL(scriptPage.url()).searchParams.get("script"), "romaji");
  assert.equal((await (await app.request("/me/progress", { token })).json()).enrolment.script, "romaji");
  await scriptPage.goto(base + "/app/n5");
  await scriptPage.getByRole("radio", { name: /Kana/ }).check();
  await scriptPage.route("**/api/n5/enrolments", async (route) => {
    assert.equal((await route.fetch()).status(), 200);
    await route.abort("failed");
  });
  await scriptPage.getByRole("button", { name: "Continue: Unit 1" }).click();
  await scriptPage.locator(".n5-error").waitFor();
  await scriptPage.unroute("**/api/n5/enrolments");
  await scriptPage.getByRole("radio", { name: /Romaji/ }).check();
  await scriptPage.getByRole("button", { name: "Continue: Unit 1" }).click();
  await lessonReady(scriptPage);
  assert.match(await scriptPage.locator(".n5-unit-head .n5-eyebrow").innerText(), /romaji/i);
  assert.equal((await (await app.request("/me/progress", { token })).json()).enrolment.script, "romaji");
  await scriptPage.getByRole("navigation", { name: "Lesson steps" }).getByRole("button", { name: /Watch/ }).click();
  await scriptPage.getByRole("button", { name: "I watched episode 1" }).click();
  await scriptPage.getByText("Episode recap", { exact: true }).waitFor();
  await scriptPage.getByRole("button", { name: /Practise this unit/ }).click();
  let lostStart;
  await scriptPage.route("**/api/n5/attempts", async (route) => {
    const response = await route.fetch();
    assert.equal(response.status(), 200);
    lostStart = await response.json();
    await route.abort("failed");
  });
  await scriptPage.getByRole("button", { name: "Begin practice" }).click();
  await scriptPage.locator(".n5-error").waitFor();
  await scriptPage.unroute("**/api/n5/attempts");
  assert.equal(lostStart.script, "romaji");
  await scriptPage.goto(base + "/app/n5");
  await scriptPage.getByRole("radio", { name: /Kana/ }).check();
  await scriptPage.getByRole("button", { name: "Continue: Unit 1" }).click();
  await lessonReady(scriptPage);
  await scriptPage.getByRole("button", { name: "Start another practice" }).click();
  await scriptPage.getByText(/Unit 1 practice · kana/).waitFor();
  const kanaId = new URL(scriptPage.url()).pathname.split("/").pop();
  assert.notEqual(kanaId, lostStart.id);
  assert.equal((await (await app.request(`/attempts/${kanaId}`, { token })).json()).script, "kana");
  await scriptPage.goto(base + lessonPath + "?script=kana");
  await scriptPage.getByRole("button", { name: "Start another practice" }).waitFor();
  await app.request("/enrolments", { token, body: { trackId: "your-lie-in-april-2014", script: "romaji", idempotencyKey: "other-tab-before-start" } });
  await scriptPage.getByRole("button", { name: "Start another practice" }).click();
  await scriptPage.getByRole("alert").filter({ hasText: "script changed" }).waitFor();
  assert.equal((await app.db.prepare("SELECT COUNT(*) AS n FROM n5_attempts").first()).n, 2);
  await scriptPage.getByRole("button", { name: "Reload lesson" }).click();
  await lessonReady(scriptPage);
  assert.match(await scriptPage.locator(".n5-unit-head .n5-eyebrow").innerText(), /romaji/i);
  await scriptContext.close();
  check("cross-tab selection and lost enrolment/start responses preserve the displayed script");
  const responses = [];
  for (const script of ["romaji", "kana"]) {
    await app.db.prepare("DELETE FROM n5_accounts").run();
    const context = await browser.newContext({
      viewport:
        script === "kana"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 960 },
    });
    await context.addInitScript(() => {
      window.__micCalls = 0;
      if (navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async () => {
          window.__micCalls++;
          throw new Error("No mic in N5 preview");
        };
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(120000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", async (r) => {
      if (
        r.url().includes("/api/n5/") &&
        r.headers()["content-type"]?.includes("application/json")
      )
        try {
          responses.push(await r.text());
        } catch {}
    });
    await page.goto(base + "/app/n5");
    await page
      .getByRole("heading", { name: "Japanese for Beginners: JLPT N5 with Your Lie in April", level: 1 })
      .waitFor();
    assert.match(
      await page.locator(".n5-about").innerText(),
      /More anime tracks are planned: SPY x FAMILY, BOCCHI THE ROCK!, Laid-Back Camp, Haikyu!!, Fruits Basket\./,
    );
    // First visit opens the course guide once.
    const guide = page.locator("dialog.n5-guide");
    await guide.getByRole("heading", { name: "Welcome to your Japanese course" }).waitFor();
    if (script === "romaji") {
      await guide.getByRole("button", { name: "Next" }).click();
      assert.ok(await guide.getByRole("button", { name: "Next" }).isDisabled());
      await guide.getByRole("radio", { name: /Romaji/ }).check();
      for (let i = 0; i < 3; i++) await guide.getByRole("button", { name: "Next" }).click();
      await guide.getByRole("heading", { name: "Passing and progress" }).waitFor();
      await guide.getByRole("button", { name: "Start Unit 1" }).click();
    } else {
      await guide.getByRole("button", { name: "Skip guide" }).click();
      await guide.waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "How this course works" }).click();
      await guide.getByRole("heading", { name: "Welcome to your Japanese course" }).waitFor();
      await page.keyboard.press("Escape");
      await guide.waitFor({ state: "hidden" });
      await page
        .getByRole("radio", { name: script === "kana" ? /Kana/ : /Romaji/ })
        .focus();
      await page.keyboard.press("Space");
      assert.ok(
        await page
          .getByRole("radio", { name: script === "kana" ? /Kana/ : /Romaji/ })
          .isChecked(),
      );
      await page.getByRole("button", { name: "Start Unit 1" }).click();
    }
    await lessonReady(page);
    await page.getByText("Step 1 of 5: Learn").waitFor();
    assert.equal(
      await page.getByText("Episode recap", { exact: true }).count(),
      0,
    );
    // Learn: real audio through the gateway, flashcard flip.
    const firstWord = (await page.locator(".n5-flashcard-face strong").innerText()).trim();
    const audio = page.waitForResponse((r) => r.url().includes("/api/n5/audio/"));
    await page.getByRole("button", { name: `Play ${firstWord}`, exact: true }).click();
    const audioResponse = await audio;
    assert.equal(audioResponse.status(), 200);
    assert.equal(audioResponse.headers()["content-type"], "audio/mpeg");
    await page.getByRole("button", { name: "Show the meaning" }).click();
    await page.locator(".n5-flashcard[data-flipped]").waitFor();
    await page.screenshot({ path: `${artifacts}/lesson-${script}.png`, fullPage: true });
    // Drill: instant feedback without server grading.
    await page.getByRole("button", { name: /I've studied these/ }).click();
    await page.keyboard.press("1");
    await page.locator(".n5-feedback").waitFor();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    check(`${script} learn audio and instant drill feedback`);
    await page.getByRole("navigation", { name: "Lesson steps" }).getByRole("button", { name: /Watch/ }).click();
    assert.equal(
      await page.locator(".n5-watch-link", { hasText: "Netflix" }).getAttribute("href"),
      "https://www.netflix.com/title/80041089",
    );
    assert.equal(
      await page.locator(".n5-watch-link", { hasText: "U-NEXT" }).getAttribute("href"),
      "https://video.unext.jp/episode/SID0012508/ED00071632",
    );
    assert.equal(await page.locator(".n5-watch-link").count(), 11);
    await page.getByRole("button", { name: "I watched episode 1" }).click();
    await page.getByText("Episode recap", { exact: true }).waitFor();
    await page.getByRole("button", { name: /Practise this unit/ }).click();
    await page.getByRole("button", { name: "Begin practice" }).click();
    await practiceReady(page);
    const id = new URL(page.url()).pathname.split("/").pop();
    const missingId = "00000000-0000-4000-8000-000000000000";
    // The course sidebar also loads progress, so a request from the page being
    // left can be cancelled mid-intercept by the navigation below.
    await page.route("**/api/n5/me/progress", async (route) => {
      try {
        const response = await route.fetch();
        const data = await response.json();
        data.attempts.push({
          id: missingId,
          script,
          status: "active",
          result: null,
        });
        await route.fulfill({ response, json: data });
      } catch {
        /* request cancelled by navigation */
      }
    });
    await page.route(`**/api/n5/attempts/${missingId}`, (route) =>
      route.fulfill({ status: 404, json: { error: { code: "not_found" } } }),
    );
    await page.goto(base + lessonPath);
    await page
      .getByRole("link", { name: `Resume unfinished ${script} practice` })
      .waitFor();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    check(
      "discarded attempt lookup does not break lesson or other resume links",
    );
    const enrolments = (
      await app.db.prepare("SELECT COUNT(*) AS n FROM n5_enrolments").first()
    ).n;
    await page.goto(base + "/app/n5");
    await page.getByRole("button", { name: "Continue: Unit 1" }).click();
    await lessonReady(page);
    await page
      .getByRole("link", { name: `Resume unfinished ${script} practice` })
      .click();
    await page.waitForURL(`**/attempts/${id}`);
    assert.equal(
      (await app.db.prepare("SELECT COUNT(*) AS n FROM n5_attempts").first()).n,
      1,
    );
    assert.equal(
      (await app.db.prepare("SELECT COUNT(*) AS n FROM n5_enrolments").first())
        .n,
      enrolments + 1,
    );
    await page.goto(base + `/app/n5/results/${id}`);
    await page.waitForURL(`**/attempts/${id}`);
    await fill(page, script);
    if (script === "kana") {
      await goQuestion(page, W1);
      await page.locator("#question-w1").fill("Haruです");
      await save(page);
      await page
        .getByRole("alert")
        .filter({ hasText: "highlighted question" })
        .waitFor();
      await page.waitForFunction(
        () => document.activeElement?.id === "question-w1",
      );
      await fill(page, script);
    }
    await page.reload();
    await practiceReady(page);
    await goQuestion(page, W1);
    assert.equal(
      await page.locator("#question-w1").inputValue(),
      correctAnswers(script).find((a) => a.questionId === "w1").value,
    );
    if (script === "romaji") {
      // A second authenticated writer advances the real server revision.
      assert.equal(
        (
          await app.request(`/attempts/${id}/answers`, {
            token,
            body: {
              revision: 0,
              idempotencyKey: "other-writer",
              answers: [{ questionId: "q1", value: "a" }],
            },
          })
        ).status,
        200,
      );
      await save(page);
      await page
        .getByRole("alert")
        .filter({ hasText: "newer version" })
        .waitFor();
      assert.equal(
        (await (await app.request(`/attempts/${id}`, { token })).json())
          .revision,
        1,
      );
      await goQuestion(page, W1);
      assert.ok(await page.locator("#question-w1").inputValue());
      await page
        .getByRole("button", {
          name: "Use server answers instead of this draft",
        })
        .click();
      await practiceReady(page);
      await fill(page, script);
      const payloads = [];
      await page.route("**/api/n5/attempts/*/answers", async (route) => {
        payloads.push(route.request().postData());
        if (payloads.length === 1) {
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      });
      await save(page);
      await page
        .getByRole("button", { name: "Retry saving answers" })
        .waitFor();
      await page.getByRole("button", { name: "Retry saving answers" }).click();
      await page
        .getByRole("status")
        .filter({ hasText: "Saved to your account" })
        .waitFor();
      assert.equal(payloads.length, 2);
      assert.equal(payloads[0], payloads[1]);
      await page.unroute("**/api/n5/attempts/*/answers");
      check(
        "real revision conflict preserves draft; lost response replays identical receipt",
      );
    } else {
      await page.route("**/api/n5/**", (route) =>
        route.abort("internetdisconnected").catch(() => {}),
      );
      await page.reload();
      await page
        .getByRole("alert")
        .filter({ hasText: "Connection unavailable" })
        .waitFor();
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.reload();
      await practiceReady(page);
      await goQuestion(page, W1);
      assert.equal(
        await page.locator("#question-w1").inputValue(),
        correctAnswers(script).find((a) => a.questionId === "w1").value,
      );
      await save(page);
      check("unsaved kana draft survives offline API failure and refresh");
    }
    await page.screenshot({
      path: `${artifacts}/quiz-${script}.png`,
      fullPage: true,
    });
    const viewport = page.viewportSize();
    await page.setViewportSize(
      script === "kana"
        ? { width: 1280, height: 960 }
        : { width: 390, height: 844 },
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: `${artifacts}/quiz-${script}-alternate.png`,
      fullPage: true,
    });
    await page.setViewportSize(viewport);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    if (script === "romaji") {
      const before = (
        await (await app.request(`/attempts/${id}`, { token })).json()
      ).revision;
      const finishes = [];
      let answerWrites = 0;
      await page.route("**/api/n5/attempts/*/answers", (route) => {
        answerWrites++;
        return route.continue();
      });
      await page.route("**/api/n5/attempts/*/finish", async (route) => {
        finishes.push(route.request().postData());
        if (finishes.length === 1) {
          await route.fetch();
          await route.abort("failed");
        } else await route.continue();
      });
      await save(page);
      await page
        .getByRole("button", { name: "Finish and see results" })
        .click();
      await page
        .getByRole("button", { name: "Retry finishing practice" })
        .waitFor();
      await goQuestion(page, W1);
      assert.ok(
        await page
          .locator("#question-w1")
          .evaluate((el) => el.readOnly && !el.disabled),
      );
      await save(page);
      await page
        .getByRole("button", { name: "Retry finishing practice" })
        .click();
      await resultsReady(page);
      assert.equal(answerWrites, 0);
      assert.equal(finishes.length, 2);
      assert.equal(finishes[0], finishes[1]);
      assert.equal(
        (await (await app.request(`/attempts/${id}`, { token })).json())
          .revision,
        before + 1,
      );
      await page.unroute("**/api/n5/attempts/*/answers");
      await page.unroute("**/api/n5/attempts/*/finish");
      check(
        "lost finish response retries finish only, with no extra answer revision",
      );
    } else {
      await page.route("**/api/n5/attempts/*/finish", (route) =>
        route.fulfill({
          status: 409,
          json: { error: { code: "incomplete_answers" } },
        }),
      );
      await save(page);
      await page
        .getByRole("button", { name: "Finish and see results" })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "couldn't complete" })
        .waitFor();
      await goQuestion(page, W1);
      assert.equal(
        await page
          .locator("#question-w1")
          .evaluate((el) => el.readOnly),
        false,
      );
      await page.locator("#question-w1").fill("アキです");
      await page.unroute("**/api/n5/attempts/*/finish");
      check(
        "definitive finish rejection unlocks editing without losing answers",
      );
      await save(page);
      await page
        .getByRole("button", { name: "Finish and see results" })
        .click();
    }
    await resultsReady(page);
    assert.match(await page.locator(".n5-score").innerText(), /8\s*\/\s*8/);
    assert.match(await page.locator("body").innerText(), /Not covered in this course/);
    // Writing feedback: reference matches need no model; kana's changed answer gets mock AI feedback.
    await page.getByText("This matches a model answer.", { exact: false }).first().waitFor();
    if (script === "kana") await page.locator('.n5-chip[data-verdict="close"]').waitFor();
    assert.equal(await page.locator(".n5-review li[data-correct]").count(), 8);
    check(`${script} results show answer review and writing feedback`);
    const result = await (
      await app.request(`/attempts/${id}`, { token })
    ).json();
    assert.equal(result.result.mastery, false);
    assert.equal(result.result.production, "needs_review");
    assert.equal(
      (
        await app.db
          .prepare("SELECT COUNT(*) AS n FROM n5_review_events")
          .first()
      ).n,
      8,
    );
    await page.reload();
    await resultsReady(page);
    assert.equal(await page.evaluate(() => window.__micCalls), 0);
    assert.ok(
      !(await page.evaluate(() => JSON.stringify(sessionStorage))).includes(
        "avc_st_",
      ),
    );
    await page.screenshot({
      path: `${artifacts}/result-${script}.png`,
      fullPage: true,
    });
    if (script === "kana") {
      const stale = await (
        await app.request("/attempts", {
          token,
          body: {
            lessonId: LESSON,
            contentVersion: "course-1",
            idempotencyKey: "stale-browser",
          },
        })
      ).json();
      await app.db
        .prepare("UPDATE n5_attempts SET pack_hash='retired' WHERE id=?")
        .bind(stale.id)
        .run();
      await page.goto(base + `/app/n5/attempts/${stale.id}`);
      await practiceReady(page);
      await fill(page, script);
      await save(page);
      await page
        .getByRole("alert")
        .filter({ hasText: "retired lesson" })
        .waitFor();
      await goQuestion(page, W1);
      assert.ok(
        await page
          .locator("#question-w1")
          .evaluate((el) => el.readOnly && !el.disabled),
      );
      await page.locator("#question-w1").focus();
      assert.equal(
        await page.locator("#question-w1").evaluate((el) => {
          el.select();
          return el.selectionEnd - el.selectionStart;
        }),
        (await page.locator("#question-w1").inputValue()).length,
      );
      await page.getByText("Discard this attempt", { exact: true }).click();
      await page
        .getByRole("button", { name: "Discard this unfinished attempt" })
        .click();
      await page.getByRole("button", { name: "Keep this attempt" }).click();
      assert.equal(
        (await app.request(`/attempts/${stale.id}`, { token })).status,
        200,
      );
      await page
        .getByRole("button", { name: "Discard this unfinished attempt" })
        .click();
      await page.getByRole("button", { name: "Confirm discard" }).click();
      await lessonReady(page);
      assert.equal(
        (await app.request(`/attempts/${stale.id}`, { token })).status,
        404,
      );
      assert.equal(
        (await app.request(`/attempts/${id}`, { token })).status,
        200,
      );
      check(
        "stale content can be discarded without deleting completed history",
      );
    }
    const recovery = await (
      await app.request("/attempts", {
        token,
        body: {
          lessonId: LESSON,
          contentVersion: "course-1",
          idempotencyKey: `auth-recovery-${script}`,
        },
      })
    ).json();
    await page.goto(base + `/app/n5/attempts/${recovery.id}`);
    await practiceReady(page);
    await fill(page, script);
    const drafts = await page.evaluate(() => Object.values(sessionStorage).join("\n"));
    await page.route("**/api/n5/**", (route) =>
      route
        .fulfill({
          status: 401,
          contentType: "text/html",
          body: "Session expired",
        })
        .catch(() => {}),
    );
    await save(page);
    await page
      .getByRole("heading", { name: "Sign in again", exact: true })
      .waitFor();
    const signIn = await page
      .getByRole("link", { name: "Sign in", exact: true })
      .getAttribute("href");
    assert.equal(
      new URL(signIn, base).searchParams.get("redirect_url"),
      `/app/n5/attempts/${recovery.id}`,
    );
    assert.ok(
      (await page.evaluate(() => Object.values(sessionStorage).join("\n"))).includes(
        '"questionId":"w1"',
      ),
    );
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.getByRole("link", { name: "Reload after signing in" }).click();
    await practiceReady(page);
    await goQuestion(page, W1);
    assert.equal(
      await page.locator("#question-w1").inputValue(),
      correctAnswers(script).find((a) => a.questionId === "w1").value,
    );
    assert.ok(drafts.includes('"questionId":"w1"'));
    // Speaking: the mic opens only on user action; a denied mic falls back to typed practice.
    await page.goto(base + `/app/n5/speak/${LESSON}`);
    await page.getByRole("button", { name: "Start conversation" }).click();
    await page.locator(".n5-chat li").first().waitFor();
    assert.equal(await page.evaluate(() => window.__micCalls), 0);
    await page.getByRole("button", { name: "Start recording" }).click();
    await page.locator("#n5-reply").waitFor();
    assert.equal(await page.evaluate(() => window.__micCalls), 1);
    await page.locator("#n5-reply").fill(script === "romaji" ? "hai, gakusei desu" : "はい、がくせいです");
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator(".n5-chat li").nth(2).waitFor();
    const chat = (await page.locator(".n5-chat [data-owned-japanese]").allTextContents()).join("");
    assert.ok(script === "romaji" ? !/[ぁ-ヿ一-龯]/u.test(chat) : !/[A-Za-z一-龯]/u.test(chat), `mixed chat: ${chat}`);
    await page.getByRole("button", { name: "End call" }).click();
    await page.getByText("Typed practice complete").waitFor();
    assert.equal((await (await app.request("/me/progress", { token })).json()).lessons[0].speaking, "practice_only");
    await page.screenshot({ path: `${artifacts}/speak-${script}.png`, fullPage: true });
    check(`${script} speaking practice with mic denial, typed fallback and rubric`);
    assert.deepEqual(errors, []);
    await context.close();
    check(
      `${script} full browser/Worker journey, layout, resume, privacy and auth loss`,
    );
  }
  assert.ok(!responses.join("").includes("correctOption"));
  assert.ok(!responses.join("").includes("avc_st_"));
  assert.ok(!responses.join("").includes("avc_n5_"));
  assert.deepEqual((await app.kv.list({ prefix: "synctoken:user:" })).keys, []);
  await stop();
  await start(false);
  assert.equal((await probe.get(base + "/api/n5/catalog")).status(), 404);
  assert.equal((await probe.get(base + "/app/n5")).status(), 404);
  await curlProbe("/api/n5/catalog", 404);
  await curlProbe("/app/n5", 404);
  check(
    "default-off page and API unavailable; no secrets or grading keys reach browser",
  );
  await stop();
  await start(true, "not-a-url");
  assert.equal((await probe.get(base + "/app")).status(), 200);
  assert.equal((await probe.get(base + "/app/n5")).status(), 404);
  check("malformed pilot config cannot break the main dashboard");
} catch (error) {
  await writeFile(`${artifacts}/next.log`, logs);
  throw error;
} finally {
  await stop();
  await probe.dispose();
  await browser.close();
  await new Promise((resolve) => kvBridge.close(resolve));
  await app.mf.dispose();
  await writeFile(`${artifacts}/next.log`, logs);
}
