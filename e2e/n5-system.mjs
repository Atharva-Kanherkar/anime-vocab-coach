import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const url = process.env.N5_SYSTEM_URL || new URL("../docs/n5-system/index.html", import.meta.url).href;
const artifacts = "/tmp/animevocab-n5-system";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on("pageerror", e => errors.push(e.message));
    const response = await page.goto(url);
    if (url.startsWith("https:")) assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: "One episode. Five steps." }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow at " + width);
    await page.getByRole("button", { name: "Kana", exact: true }).click();
    assert.equal(await page.locator("#reading").textContent(), "ともだち");
    await page.getByRole("tab", { name: "02 Watch" }).click();
    assert.equal(await page.locator("#reading").textContent(), "わたし は");
    await page.getByRole("button", { name: "Next step" }).click();
    assert.match(await page.locator("#story-title").textContent(), /Stop capture/);
    await page.getByRole("tab", { name: "03 Pause" }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator('[role="tab"][aria-selected=true]').getAttribute("id"), "tab-3");
    await page.getByRole("button", { name: "Romaji", exact: true }).click();
    assert.equal(await page.locator("#reading").textContent(), "hajimemashite");
    for (const key of ["provider", "focus", "web", "background", "api", "gateway", "d1", "kv"]) {
      await page.locator(`[data-node="${key}"]`).click();
      assert.equal(await page.locator(`[data-node="${key}"]`).getAttribute("aria-pressed"), "true");
      assert.ok((await page.locator("#detail-body").textContent()).length > 70);
    }
    await page.getByText("The connection drops.", { exact: true }).click();
    assert.ok(await page.locator("details[open]").getByText(/known access denial/).isVisible());
    assert.match(await page.locator("#progress").textContent(), /Production access remains disabled/);
    assert.match(await page.locator("body").textContent(), /Voice assessment is still pending/);
    await page.locator('[data-node="background"]').click();
    await page.getByRole("tab", { name: "01 Choose" }).click();
    await page.evaluate(() => scrollTo(0,0));
    await page.screenshot({ path: `${artifacts}/${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`PASS explainer ${width}px layout, journey, keyboard tabs, script switch and all architecture components`);
    await page.close();
  }
} finally { await browser.close(); }
