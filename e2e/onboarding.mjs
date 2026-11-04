// Hosted onboarding and redirects in a fresh browser; all network calls are local fixtures.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { resolve } from "node:path";
const extension = resolve(process.argv[2] || "extension");
const context = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    "--host-resolver-rules=MAP animevocab.com 127.0.0.1:1,MAP api.animevocab.com 127.0.0.1:1",
  ],
});
await context.route("https://animevocab.com/**", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Hosted AnimeVocab fixture</title>",
  }),
);
try {
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  for (let i = 0; i < 100; i++) {
    if (
      context
        .pages()
        .some((p) => p.url().startsWith("https://animevocab.com/start?"))
    )
      break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(
    context
      .pages()
      .some((p) => p.url().startsWith("https://animevocab.com/start?")),
  );
  console.log("PASS installation opens hosted /start");
  for (const [path, target] of [
    ["welcome/welcome.html", "/start"],
    ["options/options.html", "/app#settings"],
    ["dashboard/dashboard.html", "/app#progress"],
  ]) {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/${path}`).catch(() => {});
    await page.waitForURL("https://animevocab.com" + target);
    console.log("PASS legacy " + path + " redirects to " + target);
    await page.close();
  }
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup/popup.html`);
  await popup.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await worker.evaluate(() =>
    chrome.storage.local.set({ syncToken: "local-fixture-token" }),
  );
  await popup.locator("#settings-link").waitFor({ state: "visible" });
  const next = context.waitForEvent("page");
  await popup.locator("#settings-link").click();
  const settings = await next;
  await settings.waitForURL(
    (url) =>
      url.origin === "https://animevocab.com" && url.hash === "#settings",
  );
  console.log("PASS popup Settings opens hosted settings");
} finally {
  await context.close();
}
