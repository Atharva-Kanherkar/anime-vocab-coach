// Headed E2E for issues #111 and #112: learning-loop telemetry, end to end.
//
// Nothing is stubbed except DNS. A real Chromium loads the real unpacked
// extension; the cards, the Know / Learn buttons, the dashboard review session
// and the beacons are the shipped ones. What this asserts is what actually
// left the browser, observed as real HTTP requests arriving at a real server.
//
// HOW animevocab.com AND youtube.com ARE SERVED. Both hostnames are resolved
// to a local HTTPS server (--host-resolver-rules), which answers youtube.com
// with a watch page and animevocab.com exactly as production does: 204, empty
// body, and NO Access-Control-Allow-Origin.
//
// That last detail is the whole point, and it is why playwright's own
// route.fulfill() is deliberately NOT used here. Fulfilling a route hands the
// response straight to the renderer and skips the CORS check, so an earlier
// version of this file measured a cross-origin POST as "allowed" even from the
// page's own main world — an artefact of the harness, not a fact about Chrome.
// A real server gives a real answer, and the answer decides whether the beacon
// can be sent in place or has to be relayed through the service worker.
//
//   node e2e/learning-loop.mjs [path/to/extension]
//
// Screenshots land in e2e/shots/ and the exit code is non-zero on any failure.
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EXT = process.argv[2] || `${process.cwd()}/extension`;
const SHOTS = `${process.cwd()}/e2e/shots`;
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (n, ok, d = "") => {
  results.push({ n, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

/** A watch page: YouTube's player container, caption node, and a live video.
 *  Same shape as e2e/youtube-session.mjs — the content script only loads on
 *  the three streaming hosts, so the hostname is the part that matters. */
const watchPage = (videoId) => `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${videoId} - YouTube</title></head><body style="background:#111;color:#eee">
<div id="movie_player">
  <video class="html5-main-video" width="640" muted></video>
  <div class="ytp-caption-window-container"><span class="ytp-caption-segment"></span></div>
</div>
<script>
  const v = document.querySelector("video");
  // A canvas stream is a genuinely playing video with no codec and no network,
  // which is what the card's dismissal timer listens to.
  const c = document.createElement("canvas");
  c.width = 320; c.height = 180;
  const g = c.getContext("2d");
  setInterval(() => { g.fillStyle = "#123"; g.fillRect(0, 0, 320, 180); }, 100);
  v.srcObject = c.captureStream(10);
  v.play().catch(() => {});
  window.avcCaption = (t) => { document.querySelector(".ytp-caption-segment").textContent = t; };
</script></body></html>`;

const CARD = "#avc-overlay-host .avc-agent-word-block.avc-active";
const FOOT = "#avc-overlay-host .avc-agent-foot.avc-active";
const LINES = [
  "父はまだ帰らない。",
  "約束を守ると言った。",
  "電車が遅れている。",
  "記憶が戻らないままだ。",
  "彼女は静かに笑った。",
];
const TEST_TOKEN = "avc_st_e2etoken0000000000";

// ------------------------------------------------------------- request log

/** Every POST /api/track that reached the server, oldest first. */
const beacons = [];
/** Every other animevocab.com request, so a leak or a surprise is visible. */
const otherCalls = [];

const named = (name) => beacons.filter((b) => b.name === name);
const sinceMark = () => beacons.length;
const after = (mark) => beacons.slice(mark);

// ------------------------------------------- a real animevocab.com + youtube

const TLS_PORT = Number(process.env.AVC_E2E_PORT || 8443);
const certDir = mkdtempSync(join(tmpdir(), "avc-e2e-tls-"));
execFileSync(
  "openssl",
  [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", join(certDir, "key.pem"),
    "-out", join(certDir, "cert.pem"),
    "-days", "1",
    "-subj", "/CN=avc-e2e",
    "-addext", "subjectAltName=DNS:animevocab.com,DNS:www.youtube.com",
  ],
  { stdio: "ignore" }
);

const server = createServer(
  {
    key: readFileSync(join(certDir, "key.pem")),
    cert: readFileSync(join(certDir, "cert.pem")),
  },
  (req, res) => {
    const host = (req.headers.host || "").split(":")[0];
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (host.endsWith("youtube.com")) {
        const id = new URL(req.url, "https://www.youtube.com").searchParams.get("v") || "unknown";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(watchPage(id));
        return;
      }

      const raw = Buffer.concat(chunks).toString("utf8");
      const entry = {
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization || null,
        // chrome-extension://… means the request was made with the extension's
        // own privileges; a https://www.youtube.com origin means it was made by
        // a page (or a content script) and is therefore CORS-checked.
        origin: req.headers.origin || null,
      };
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        body = { unparseable: raw };
      }
      if (req.url === "/api/track" && req.method === "POST") {
        beacons.push({ ...entry, kind: body.kind, name: body.name, v: body.v, at: Date.now() });
      } else {
        // `event` is the extension-funnel beacon's field name (/api/extension/track).
        otherCalls.push({ ...entry, event: body.event, v: body.v });
      }
      // Production's answer: 204, empty, and no Access-Control-* of any kind.
      res.writeHead(204).end();
    });
  }
);
await new Promise((resolve) => server.listen(TLS_PORT, "127.0.0.1", resolve));

const ctx = await chromium.launchPersistentContext("", {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // The beacon's URL is hardcoded to the production host, so the host is
    // pointed at this process rather than editing the extension for the test.
    // NOTE: no ctx.route() anywhere in this file — enabling playwright's
    // request interception makes page-originated requests to a mapped host
    // fail outright, which silently invalidates the CORS measurement below.
    `--host-resolver-rules=MAP animevocab.com 127.0.0.1:${TLS_PORT},MAP www.youtube.com 127.0.0.1:${TLS_PORT}`,
    "--ignore-certificate-errors",
  ],
});

try {
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 15000 }));

  /** Wait until `pred(beacons)` holds, or give up. */
  async function waitForBeacon(pred, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (pred(beacons)) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  }

  // ── 1. install_first_run ──────────────────────────────────────────────────
  // Fired by the real onInstalled handler; nothing here seeds it.
  const sawInstall = await waitForBeacon((b) => b.some((x) => x.name === "install_first_run"), 20000);
  check("a fresh install reports install_first_run", sawInstall, JSON.stringify(named("install_first_run")));
  check(
    "it is anonymous, because nothing is linked one tick after install",
    named("install_first_run").every((b) => b.authorization === null)
  );
  check(
    "it is sent with the extension's own privileges, not a page's",
    named("install_first_run").every((b) => String(b.origin).startsWith("chrome-extension://")),
    JSON.stringify(named("install_first_run").map((b) => b.origin))
  );
  check(
    "every beacon declares itself a feature event",
    beacons.length > 0 && beacons.every((b) => b.kind === "feature"),
    JSON.stringify([...new Set(beacons.map((b) => b.kind))])
  );

  // ── 2. who may talk to animevocab.com from a youtube.com tab ──────────────
  //
  // This is the measurement the relay depends on. The page's own main world is
  // the control: it is an ordinary cross-origin caller and MUST be blocked. If
  // the control were allowed, the harness would be bypassing CORS and the
  // content-script result below would mean nothing.
  const page = await ctx.newPage();
  await page.goto("https://www.youtube.com/watch?v=videoA", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!document.querySelector("video"), null, { timeout: 10000 });

  const probe = (url, name) => `(async () => {
    try {
      const r = await fetch(${JSON.stringify(url)}, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "feature", name: ${JSON.stringify(name)} }),
      });
      return { sent: true, status: r.status };
    } catch (err) {
      return { sent: false, error: String(err) };
    }
  })()`;

  const fromPage = await page.evaluate(probe("https://animevocab.com/api/track", "__probe_page__"));
  check(
    "control — the youtube.com page itself is blocked by CORS",
    fromPage.sent === false,
    fromPage.sent ? `unexpectedly sent, status ${fromPage.status}` : fromPage.error
  );

  const tabId = await sw.evaluate(() =>
    chrome.tabs.query({ url: "*://*.youtube.com/*" }).then((t) => t[0]?.id ?? null)
  );
  check("the watch page is a real tab the extension can script", typeof tabId === "number", `tabId ${tabId}`);

  /** Run a probe in the content script's own isolated world on that tab. */
  const inContentScript = (url, name) =>
    sw.evaluate(
      async ([id, u, n]) => {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: id },
          world: "ISOLATED",
          args: [u, n],
          func: async (u2, n2) => {
            try {
              const r = await fetch(u2, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ kind: "feature", name: n2, event: n2 }),
              });
              return { sent: true, status: r.status };
            } catch (err) {
              return { sent: false, error: String(err) };
            }
          },
        });
        return res.result;
      },
      [tabId, url, name]
    );

  const fromContentScript = await inContentScript("https://animevocab.com/api/track", "__probe_content__");
  check(
    "#111 a content script CANNOT post to animevocab.com — so the beacon must be relayed",
    fromContentScript.sent === false,
    fromContentScript.sent ? `unexpectedly sent, status ${fromContentScript.status}` : fromContentScript.error
  );
  check(
    "and it was a CORS block, not a network failure (the preflight did arrive)",
    otherCalls.some((c) => c.method === "OPTIONS" && c.origin === "https://www.youtube.com"),
    JSON.stringify(otherCalls.filter((c) => c.method === "OPTIONS").map((c) => `${c.url} ${c.origin}`))
  );
  check(
    "neither probe reached the beacon log",
    !beacons.some((b) => String(b.name).startsWith("__probe")),
    JSON.stringify(beacons.map((b) => b.name))
  );

  // The same block applies to the pre-existing extension-funnel beacon, which
  // fetches /api/extension/track directly from this very context.
  const funnelFromContentScript = await inContentScript(
    "https://animevocab.com/api/extension/track",
    "first_card_created"
  );
  check(
    "the same block applies to /api/extension/track from a content script",
    funnelFromContentScript.sent === false,
    funnelFromContentScript.sent ? `sent, status ${funnelFromContentScript.status}` : funnelFromContentScript.error
  );

  // ── 3. card_shown, from the real pipeline ─────────────────────────────────
  await sw.evaluate(() =>
    chrome.storage.local.set({
      settings: {
        pauseMode: "copilot",
        cooldownSec: 0,
        maxCardsPerHour: 99,
        autoResumeSec: 30,
        autoSpeak: false,
        subLens: false,
        targetLevel: 5,
        learningDirection: "en-ja",
      },
      vocab: {},
      stats: { daily: {}, cardTimestamps: [] },
    })
  );
  await page.waitForTimeout(6000); // kuromoji + dictionary load

  /** Feed subtitle lines until a card is on screen. */
  async function cardOnScreen(timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let i = 0;
    while (Date.now() < deadline) {
      await page.evaluate((line) => window.avcCaption(line), LINES[i++ % LINES.length]);
      try {
        await page.waitForSelector(CARD, { timeout: 4000, state: "attached" });
        return true;
      } catch {
        /* that line produced no card; try the next */
      }
    }
    return false;
  }

  let mark = sinceMark();
  const raised = await cardOnScreen();
  check("a subtitle line raises a word card", raised);
  if (!raised) throw new Error("no card was ever shown; the rest of the run would be meaningless");

  const shownWord = await page.locator(`${CARD} .avc-agent-word`).first().innerText().catch(() => "");
  check(
    "showing a card reports card_shown",
    await waitForBeacon((b) => b.slice(mark).some((x) => x.name === "card_shown")),
    `word ${JSON.stringify(shownWord)}, got ${JSON.stringify(after(mark).map((b) => b.name))}`
  );
  check(
    "the relayed beacon carries the extension's origin, not youtube.com's",
    after(mark).every((b) => String(b.origin).startsWith("chrome-extension://")),
    JSON.stringify(after(mark).map((b) => b.origin))
  );
  await page.screenshot({ path: `${SHOTS}/learning-loop-1-card-shown.png` });

  // ── 4. Know → card_known + word_saved, once ───────────────────────────────
  mark = sinceMark();
  const knowBtn = page.locator(`${FOOT} button:has-text("Know")`).first();
  check("the card offers Know", (await knowBtn.count()) === 1);
  await knowBtn.click();

  check(
    "Know reports card_known",
    await waitForBeacon((b) => b.slice(mark).some((x) => x.name === "card_known")),
    JSON.stringify(after(mark).map((b) => b.name))
  );
  check(
    "and word_saved, because a new card entered the deck",
    after(mark).some((b) => b.name === "word_saved"),
    JSON.stringify(after(mark).map((b) => b.name))
  );
  check("exactly one word_saved for one new card", after(mark).filter((b) => b.name === "word_saved").length === 1);
  check("Know does not report a review", !after(mark).some((b) => b.name === "review_done"));

  // Regression guard for the pre-existing bug this run uncovered: the older
  // extension-funnel counters are fired from the same content-script path and
  // were being dropped by CORS before they ever left the tab, so #75's funnel
  // never saw a first card. They are relayed now, and must arrive.
  const funnelPosts = () => otherCalls.filter((c) => c.url === "/api/extension/track" && c.method === "POST");
  check(
    "the extension-funnel milestone reaches the server too (pre-existing CORS drop)",
    await (async () => {
      const deadline = Date.now() + 8000;
      while (Date.now() < deadline) {
        if (funnelPosts().some((c) => c.event === "first_card_created")) return true;
        await new Promise((r) => setTimeout(r, 150));
      }
      return false;
    })(),
    JSON.stringify(funnelPosts().map((c) => `${c.event} (${c.origin})`))
  );

  // ── 5. Learn → card_learn ─────────────────────────────────────────────────
  mark = sinceMark();
  const raisedAgain = await cardOnScreen();
  check("a second line raises another card", raisedAgain);
  if (raisedAgain) {
    const learnBtn = page.locator(`${FOOT} button:has-text("Learn")`).first();
    check("the card offers Learn", (await learnBtn.count()) === 1);
    await learnBtn.click();
    check(
      "Learn reports card_learn",
      await waitForBeacon((b) => b.slice(mark).some((x) => x.name === "card_learn")),
      JSON.stringify(after(mark).map((b) => b.name))
    );
    check("and word_saved for the second new card too", after(mark).some((b) => b.name === "word_saved"));
    await page.screenshot({ path: `${SHOTS}/learning-loop-2-after-learn.png` });
  }

  // ── 6. review_done, from the dashboard's real review session ──────────────
  mark = sinceMark();
  const learned = await sw.evaluate(async () => {
    const r = await chrome.storage.local.get("vocab");
    return Object.entries(r.vocab || {})
      .filter(([, v]) => v.state === "learning")
      .map(([k]) => k);
  });
  check("a word is now in the learning deck", learned.length > 0, JSON.stringify(learned));

  if (learned.length > 0) {
    // A word judged "Learn" is scheduled hours out, so nothing is due yet.
    // Backdate the schedule rather than waiting for the SRS interval.
    await sw.evaluate(async () => {
      const r = await chrome.storage.local.get("vocab");
      const vocab = r.vocab || {};
      for (const rec of Object.values(vocab)) {
        if (rec.srs) rec.srs.dueAt = Date.now() - 1000;
      }
      await chrome.storage.local.set({ vocab });
    });

    const dash = await ctx.newPage();
    const id = new URL(sw.url()).host;
    await dash.goto(`chrome-extension://${id}/dashboard/dashboard.html`, { waitUntil: "domcontentloaded" });
    await dash.waitForSelector("#review-start", { timeout: 8000 }).catch(() => {});
    const startable = (await dash.locator("#review-start").count()) > 0;
    check("a due word offers a review session on the dashboard", startable);

    if (startable) {
      await dash.locator("#review-start").click();
      await dash.waitForSelector("#review-show", { timeout: 5000 });
      await dash.locator("#review-show").click();
      await dash.waitForSelector("#review-got", { state: "visible", timeout: 5000 });
      await dash.screenshot({ path: `${SHOTS}/learning-loop-3-review.png` });
      await dash.locator("#review-got").click();

      check(
        "passing a review reports review_done",
        await waitForBeacon((b) => b.slice(mark).some((x) => x.name === "review_done")),
        JSON.stringify(after(mark).map((b) => b.name))
      );
      check(
        "a review does not report another word_saved",
        !after(mark).some((b) => b.name === "word_saved"),
        JSON.stringify(after(mark).map((b) => b.name))
      );
    }
    await dash.close();
  }

  // ── #159: every beacon names the build that sent it ───────────────────────
  {
    const version = JSON.parse(readFileSync(join(EXT, "manifest.json"), "utf8")).version;
    const unstamped = beacons.filter((b) => b.v !== version);
    check(
      `#159 every learning-loop beacon carries the build version (${version})`,
      beacons.length > 0 && unstamped.length === 0,
      JSON.stringify(unstamped.map((b) => `${b.name}:${b.v}`))
    );
    const funnel = otherCalls.filter((c) => c.event);
    check(
      "#159 funnel beacons carry the build version too",
      funnel.every((c) => c.v === version),
      JSON.stringify(funnel.map((c) => `${c.event}:${c.v}`))
    );
  }

  // ── 7. extension_linked, and the bearer that makes rows attributable ──────
  mark = sinceMark();
  await sw.evaluate((t) => chrome.storage.local.set({ syncToken: t }), TEST_TOKEN);
  check(
    "linking an account reports extension_linked",
    await waitForBeacon((b) => b.slice(mark).some((x) => x.name === "extension_linked")),
    JSON.stringify(after(mark).map((b) => b.name))
  );
  check(
    "#112 a linked install sends the sync token, so the row can carry a userId",
    after(mark).some((b) => b.authorization === `Bearer ${TEST_TOKEN}`),
    JSON.stringify(after(mark).map((b) => `${b.name}:${b.authorization}`))
  );

  // Re-writing the SAME token is not a new activation.
  mark = sinceMark();
  await sw.evaluate((t) => chrome.storage.local.set({ syncToken: t }), TEST_TOKEN);
  await new Promise((r) => setTimeout(r, 1500));
  check(
    "re-storing the same token does not report a second link",
    !after(mark).some((b) => b.name === "extension_linked"),
    JSON.stringify(after(mark).map((b) => b.name))
  );

  // ── 8. a later card carries the token ─────────────────────────────────────
  mark = sinceMark();
  const raisedLinked = await cardOnScreen();
  check(
    "a card shown while linked is attributable to that learner",
    raisedLinked &&
      (await waitForBeacon((b) =>
        b.slice(mark).some((x) => x.name === "card_shown" && x.authorization === `Bearer ${TEST_TOKEN}`)
      )),
    JSON.stringify(after(mark).map((b) => `${b.name}:${b.authorization}`))
  );

  // ── 9. the relay refuses a name the server would drop ─────────────────────
  mark = sinceMark();
  await sw
    .evaluate(
      (id) =>
        chrome.scripting.executeScript({
          target: { tabId: id },
          world: "ISOLATED",
          func: () => chrome.runtime.sendMessage({ type: "avc-track-feature", event: "arbitrary_string" }),
        }),
      tabId
    )
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  check(
    "the relay drops an event name that is not on the allowlist",
    !after(mark).some((b) => b.name === "arbitrary_string"),
    JSON.stringify(after(mark).map((b) => b.name))
  );

  console.log(`\nbeacons: ${JSON.stringify(beacons.map((b) => b.name))}`);
  console.log(
    `other animevocab.com traffic: ${JSON.stringify([
      ...new Set(otherCalls.map((c) => `${c.method} ${c.url} (${c.origin || "no origin"})`)),
    ])}`
  );
} finally {
  await ctx.close();
  await new Promise((resolve) => server.close(resolve));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots in ${SHOTS}`);
if (failed.length) {
  console.log(`failed: ${failed.map((f) => f.n).join(" | ")}`);
  process.exit(1);
}
