// Fresh Chromium + the built extension + actual Next routes and local D1.
// Start web with NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 PORT=3498 npm run dev,
// after `cd web && npx wrangler d1 migrations apply avc-n5 --local`.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "node:https";
import { mkdtemp, readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const base = process.env.LEARN_E2E_BASE || "http://localhost:3498";
assert.ok(
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base),
  "local fixture server required",
);
const fixtureToken = await (
  await fetch(base + "/api/sync/token", { method: "POST" })
).json();
assert.equal(
  fixtureToken.profile?.email,
  "dev@animevocab.test",
  "dev-only fixture identity required",
);
const artifacts = "/tmp/animevocab-cloud-first";
await mkdir(artifacts, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "avc-learn-"));
const clean = () => {
  const tables = [
    "learn_words",
    "learn_daily",
    "learn_settings",
    "learn_notebooks",
    "learn_notebook_items",
    "learn_ops",
    "learn_review_log",
    "learn_accounts",
  ];
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "kv",
      "key",
      "delete",
      "learn:deleted:dev-user",
      "--binding",
      "AVC_SYNC_KV",
      "--local",
    ],
    { cwd: resolve("web"), stdio: "pipe" },
  );
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "avc-n5",
      "--local",
      "--command",
      tables.map((t) => `DELETE FROM ${t} WHERE user_id='dev-user'`).join(";"),
    ],
    { cwd: resolve("web"), stdio: "pipe" },
  );
};
clean();
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(temp, "key.pem"),
    "-out",
    join(temp, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=avc-local-test",
  ],
  { stdio: "ignore" },
);
let offline = false;
const server = createServer(
  {
    key: await readFile(join(temp, "key.pem")),
    cert: await readFile(join(temp, "cert.pem")),
  },
  async (req, res) => {
    try {
      const host = req.headers.host?.split(":")[0];
      if (host === "www.netflix.com") {
        res
          .writeHead(200, { "Content-Type": "text/html" })
          .end(
            `<!doctype html><html><head><meta charset="utf-8"><title>Learning fixture</title></head><body style="background:#111"><div class="watch-video"><video muted width="960" height="540"></video><div class="player-timedtext"><div class="player-timedtext-text-container"></div></div></div><script>const v=document.querySelector('video'),c=document.createElement('canvas');c.width=320;c.height=180;setInterval(()=>{const g=c.getContext('2d');g.fillStyle='#123';g.fillRect(0,0,320,180)},100);v.srcObject=c.captureStream(10);v.play();</script></body></html>`,
          );
        return;
      }
      if (
        req.url.startsWith("/api/learn/") ||
        req.url.startsWith("/api/sync/snapshot") ||
        req.url.startsWith("/api/sync/review")
      ) {
        if (offline) {
          res
            .writeHead(503, { "Content-Type": "application/json" })
            .end('{"error":"offline_fixture"}');
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const response = await fetch(base + req.url, {
          method: req.method,
          headers: {
            ...(req.headers.authorization
              ? { Authorization: req.headers.authorization }
              : {}),
            "Content-Type": "application/json",
          },
          ...(body.length ? { body } : {}),
        });
        res
          .writeHead(response.status, { "Content-Type": "application/json" })
          .end(await response.text());
        return;
      }
      if (req.url.startsWith("/api/sync/token")) {
        res
          .writeHead(401, { "Content-Type": "application/json" })
          .end('{"error":"signed_out_fixture"}');
        return;
      }
      if (req.url.startsWith("/api/")) {
        res.writeHead(204).end();
        return;
      }
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end(
          "<!doctype html><title>AnimeVocab local fixture</title><p>Sign in to AnimeVocab</p>",
        );
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  },
);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ext = resolve("extension");
const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
    `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${port},MAP api.animevocab.com 127.0.0.1:${port},MAP www.netflix.com 127.0.0.1:${port}`,
    "--ignore-certificate-errors",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const checks = [];
const pass = (n) => {
  checks.push(n);
  console.log("PASS " + n);
};
const until = async (fn, timeout = 15000) => {
  const end = Date.now() + timeout;
  for (;;) {
    const r = await fn();
    if (r) return r;
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 100));
  }
};
try {
  const sw =
    ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker"));
  await until(() =>
    sw.evaluate(
      async () => !!(await chrome.storage.local.get("settings")).settings,
    ),
  );
  const id = new URL(sw.url()).host;
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  const rpc = (method, args = []) =>
    popup.evaluate(
      async ({ method, args }) => {
        const reply = await chrome.runtime.sendMessage({
          type: "avc-learning-write",
          method,
          args,
        });
        if (reply?.error) throw new Error(reply.error);
        return reply?.value;
      },
      { method, args },
    );
  const local = (keys) =>
    sw.evaluate((keys) => chrome.storage.local.get(keys), keys);
  assert.equal((await local(["syncToken"])).syncToken || "", "");
  const watch = await ctx.newPage();
  await watch.goto("https://www.netflix.com/watch/198");
  await watch.waitForTimeout(2000);
  await watch.evaluate(() => {
    const vtt = (text) =>
      "WEBVTT\n\n" +
      Array.from(
        { length: 5 },
        (_, i) =>
          `${i}\n00:${String(i).padStart(2, "0")}:00.000 --> 00:${String(i + 1).padStart(2, "0")}:00.000\n${text}\n`,
      ).join("\n");
    window.postMessage(
      {
        source: "avc",
        type: "avc-netflix-timedtext",
        movieId: "198",
        ja: { text: vtt("猫が好きです。") },
        en: { text: vtt("I like cats.") },
      },
      location.origin,
    );
  });
  await watch.waitForFunction(
    () =>
      document
        .querySelector("[data-avc-sub-lens]")
        ?.shadowRoot?.querySelector(".lens.on .line.en")
        ?.textContent?.includes("I like cats"),
    null,
    { timeout: 20000 },
  );
  await watch.screenshot({
    path: join(artifacts, "signed-out-dual-subtitles.png"),
  });
  pass("signed-out learner watches native dual subtitles");
  await watch
    .locator("[data-avc-sub-lens] .line.jp .tok")
    .filter({ hasText: "neko" })
    .first()
    .click();
  await until(
    async () => (await local(["learnSigninPrompted"])).learnSigninPrompted,
  );
  assert.ok((await local(["learnOutbox"])).learnOutbox.length > 0);
  await until(() =>
    ctx.pages().some((p) => p.url().startsWith("https://animevocab.com/start")),
  );
  pass("first signed-out save persists and opens hosted sign-in");
  const token = await (
    await fetch(base + "/api/sync/token", { method: "POST" })
  ).json();
  assert.ok(token.token);
  await popup.evaluate(
    ({ token, profile }) =>
      chrome.runtime.sendMessage({ type: "avc-link-token", token, profile }),
    token,
  );
  await until(async () =>
    (
      await (await fetch(base + "/api/sync/snapshot")).json()
    ).envelope.snapshot.words.some((w) => w.base === "猫"),
  );
  assert.equal((await local(["learnOutbox"])).learnOutbox.length, 0);
  pass("link imports queued save and acknowledges the durable outbox");
  const savedAt = Date.now();
  await rpc("judgeWord", [
    "犬",
    "learn",
    { reading: "inu", gloss: "dog", level: 5, freqRank: 2 },
  ]);
  await until(
    async () =>
      (
        await (await fetch(base + "/api/sync/snapshot")).json()
      ).envelope.snapshot.words.some((w) => w.base === "犬"),
    5000,
  );
  const onlineMs = Date.now() - savedAt;
  assert.ok(onlineMs < 5000);
  pass(`online save appears on site within five seconds (${onlineMs} ms)`);
  offline = true;
  await rpc("judgeWord", [
    "空",
    "learn",
    { reading: "sora", gloss: "sky", level: 5, freqRank: 3 },
  ]);
  await popup.evaluate(() =>
    chrome.runtime.sendMessage({ type: "avc-sync-now" }),
  );
  assert.ok((await local(["learnOutbox"])).learnOutbox.length > 0);
  offline = false;
  await watch.evaluate(()=>window.dispatchEvent(new Event("online")));
  await until(async () =>
    (
      await (await fetch(base + "/api/sync/snapshot")).json()
    ).envelope.snapshot.words.some((w) => w.base === "空"),
  );
  pass("offline save survives failure and syncs on reconnect");
  const day = new Date().toLocaleDateString("sv");
  const phone = {
    base: "猫",
    result: "pass",
    day,
    op_id: crypto.randomUUID(),
    client_ts: new Date().toISOString(),
  };
  const phoneResponse = await fetch(base + "/api/sync/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(phone),
  });
  assert.equal(phoneResponse.status, 200);
  await rpc("judgeWord", [
    "猫",
    "review-pass",
    { reading: "neko", gloss: "cat", level: 5, freqRank: 1 },
  ]);
  await popup.evaluate(() =>
    chrome.runtime.sendMessage({ type: "avc-sync-now" }),
  );
  await until(async () => (await local(["vocab"])).vocab?.猫?.srs?.stage === 3);
  let account = await (await fetch(base + "/api/learn/export")).json();
  assert.equal(account.reviews.length, 2);
  await fetch(base + "/api/sync/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(phone),
  });
  account = await (await fetch(base + "/api/learn/export")).json();
  assert.equal(account.reviews.length, 2);
  pass(
    "phone and extension reviews both survive, including a lost-response retry",
  );
  const app = await ctx.newPage();
  await app.goto(base + "/app#settings");
  await app.getByRole("heading", { name: "Study settings" }).waitFor();
  const lens = app.getByLabel("Dual subtitles and interactive Subtitle Lens", {
    exact: true,
  });
  await lens.uncheck();
  await app
    .getByLabel("Pause while a word lookup is open", { exact: true })
    .uncheck();
  await app.getByLabel("Max cards per hour", { exact: true }).fill("9");
  await app.getByRole("button", { name: "Save settings", exact: true }).click();
  await app
    .getByText("Saved. Your extension applies this within one sync.", {
      exact: true,
    })
    .waitFor();
  await popup.evaluate(() =>
    chrome.runtime.sendMessage({ type: "avc-sync-now" }),
  );
  await until(async () => {
    const r = await local(["settings"]);
    return (
      r.settings?.subLens === false &&
      r.settings?.subLensPeek === false &&
      r.settings?.maxCardsPerHour === 9
    );
  }).catch(async (err) => {
    console.log(
      "SETTINGS DEBUG",
      JSON.stringify({
        cloud: (await (await fetch(base + "/api/sync/snapshot")).json())
          .envelope.snapshot.settings,
        cache: await local(["syncStatus", "learnCursor", "learnOutbox"]),
      }),
    );
    throw err;
  });
  await app.screenshot({
    path: join(artifacts, "settings-desktop.png"),
    fullPage: true,
  });
  await app.setViewportSize({ width: 390, height: 844 });
  await app.screenshot({
    path: join(artifacts, "settings-phone.png"),
    fullPage: true,
  });
  assert.ok(
    await app.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  pass(
    "site settings form persists on desktop and phone and reaches extension",
  );
  for (const [path, target] of [
    ["options/options.html", "/app#settings"],
    ["welcome/welcome.html", "/start"],
    ["dashboard/dashboard.html", "/app#progress"],
  ]) {
    console.log("Checking legacy redirect", path);
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/${path}`).catch(() => {});
    await page.waitForURL(
      (url) =>
        url.origin === "https://animevocab.com" &&
        url.pathname + url.hash === target,
      { timeout: 10000 },
    );
    await page.close();
  }
  pass("legacy options, welcome and removed dashboard open the hosted site");
  const devicePage = await ctx.newPage();
  await devicePage.goto("https://animevocab.com/app#settings");
  const keySaved = await devicePage.evaluate(
    () =>
      new Promise((resolve) => {
        const requestId = crypto.randomUUID();
        const listener = (event) => {
          if (
            event.source === window &&
            event.data?.type === "avc-device-key-saved" &&
            event.data.requestId === requestId
          ) {
            window.removeEventListener("message", listener);
            resolve(event.data.ok);
          }
        };
        window.addEventListener("message", listener);
        window.postMessage(
          {
            source: "avc-web",
            type: "avc-device-key",
            requestId,
            value: "fixture-device-key",
          },
          location.origin,
        );
      }),
  );
  assert.equal(keySaved, true);
  assert.equal(
    (await local(["settings"])).settings.openaiKey,
    "fixture-device-key",
  );
  assert.ok(
    !JSON.stringify(
      await (await fetch(base + "/api/learn/export")).json(),
    ).includes("fixture-device-key"),
  );
  await devicePage.close();
  pass("site device-key bridge stores the key only in this extension");

  // Verify the site exposes the complete account export and the same learner deletion route.
  assert.ok(account.operations.length > 0 && account.vocab.猫 && account.stats);
  const deletion = await fetch(base + "/api/learn/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  assert.equal(deletion.status, 200);
  // Self-serve deletion empties the store but leaves the account usable.
  const afterDeletion = await fetch(base + "/api/learn/changes?since=0");
  assert.equal(afterDeletion.status, 200);
  const reset = await afterDeletion.json();
  assert.equal(reset.changes.length, 0);
  assert.ok(reset.epoch >= 1);
  assert.deepEqual(
    (await (await fetch(base + "/api/learn/export")).json()).vocab,
    {},
  );
  pass(
    "account export includes reviews and deletion resets learner data without locking the account",
  );
  await mkdir(artifacts, { recursive: true });
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(
      join(artifacts, "results.json"),
      JSON.stringify({ checks, onlineMs }, null, 2),
    ),
  );
} finally {
  await ctx.close();
  await new Promise((r) => server.close(r));
  await rm(temp, { recursive: true, force: true });
  clean();
}
console.log(`${checks.length} cloud-first browser checks passed`);
