// Browser check for issue #133: the /app connection banner must never report a
// broken link while the extension is answering, must name what actually failed,
// and must heal itself when the failure was transient.
//
// The real page code runs; the extension side is simulated by posting the exact
// messages sync-bridge.ts posts (pinned in extension-link-wiring.test.ts). That
// is deliberate: serving /app at the animevocab.com origin, so the real content
// script loads, stops the dev server's client bundle from hydrating, and the
// packaged extension cannot be loaded against localhost.
//
// Usage:
//   NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 npm run dev --prefix web -- --port 4311
//   node e2e/app-link-status.mjs [http://localhost:4311]
import { chromium } from "playwright";

const BASE = (process.argv[2] || "http://localhost:4311").replace(/\/$/, "");
const results = [];
const check = (n, ok, d = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
};

/** Status to fail the token mint with; null lets it through. */
let failTokenWith = null;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

try {
  await ctx.route("**/api/sync/token", async (route) => {
    if (failTokenWith === null) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: failTokenWith,
      contentType: "application/json",
      body: JSON.stringify({ error: "forced by e2e" }),
    });
  });

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("   [pageerror]", String(e).slice(0, 200)));

  await page.addInitScript(() => {
    const announce = () => {
      const origin = location.origin;
      window.postMessage({ source: "avc-ext", type: "avc-ext-present" }, origin);
      window.postMessage({ source: "avc-ext", type: "avc-request-token" }, origin);
      // Persisted, so a reload keeps whatever the test set (the init script
      // runs before page code on every load).
      let stored = null;
      try {
        stored = sessionStorage.getItem("avcFakeLinked");
      } catch {}
      if (stored === "true" || stored === "false") {
        window.postMessage({ source: "avc-ext", type: "avc-ext-present", linked: stored === "true" }, origin);
      }
    };
    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      const data = e.data;
      if (data && data.source === "avc-web" && data.type === "avc-ping-extension") announce();
    });
    announce();
  });

  const banner = async () =>
    (await page.locator('[aria-live="polite"]').first().innerText().catch(() => ""))
      .replace(/\s+/g, " ")
      .trim();

  /**
   * A stand-in for sync-bridge.ts: answers the page's ping with the same
   * messages the real bridge posts. Installed as an init script so it is in
   * place before any page code runs, which is also how the real content script
   * behaves, and so no announcement can race the page's listener.
   */
  const setExtensionLinked = (linked) =>
    page.evaluate((v) => {
      if (v === null) sessionStorage.removeItem("avcFakeLinked");
      else sessionStorage.setItem("avcFakeLinked", String(v));
    }, linked);

  const waitForBanner = async (re, timeout = 20000) =>
    page
      .waitForFunction(
        (pattern) => new RegExp(pattern, "i").test(document.querySelector('[aria-live="polite"]')?.textContent || ""),
        re.source,
        { timeout }
      )
      .then(() => true)
      .catch(() => false);

  // ── The mint works ────────────────────────────────────────────────────────
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  check("dev server reachable and /app hydrated", await waitForBanner(/checking for extension/), await banner());
  check("#133 a working mint reads as connected", await waitForBanner(/extension connected/), await banner());

  // ── The mint fails, extension still answering ─────────────────────────────
  // The reported bug: popup says signed in and syncing, /app says the link failed.
  failTokenWith = 503;
  await page.reload({ waitUntil: "domcontentloaded" });
  const named = await waitForBanner(/temporarily unavailable \(503\)/);
  const shown = await banner();
  check("#133 the banner names the real failure and its status", named, shown);
  check("#133 it never claims the link is broken", !/could not link/i.test(shown), shown);
  check("#133 it still reports the extension as connected", /extension connected/i.test(shown), shown);
  check("#133 retry is offered", (await page.locator('button:has-text("retry")').count()) > 0);

  // ── It heals itself ───────────────────────────────────────────────────────
  failTokenWith = null;
  const healed = await waitForBanner(/^(?!.*unavailable).*extension connected/, 25000);
  check("#133 a transient failure clears itself with no click", healed, await banner());

  // ── The extension says it already holds a token ───────────────────────────
  failTokenWith = 500;
  await setExtensionLinked(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const withLinked = await waitForBanner(/already linked and syncing/);
  check("#133 an extension that reports itself linked reads healthy", withLinked, await banner());

  // ── A signed-out mint ─────────────────────────────────────────────────────
  await setExtensionLinked(null); // back to an extension that says nothing
  failTokenWith = 401;
  await page.reload({ waitUntil: "domcontentloaded" });
  const session = await waitForBanner(/sign in again/);
  const sessionText = await banner();
  check("#133 a 401 names the session, not the link", session && !/could not link/i.test(sessionText), sessionText);
} finally {
  await ctx.close();
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
