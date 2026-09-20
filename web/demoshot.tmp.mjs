// Visual + interactive verification of the demo strip (dev server).
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:3500";
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.goto(`${BASE}/`, { waitUntil: "networkidle" });

await p.evaluate(() => document.getElementById("demo")?.scrollIntoView({ behavior: "instant" }));
await p.waitForTimeout(600);
await p.screenshot({ path: "/tmp/shots/strip-1-capture.png" });

await p.locator("#demo-listening").scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: "/tmp/shots/strip-2-listening.png" });
await p.locator("#demo-listening").getByRole("button", { name: "Pause" }).click();
await p.waitForTimeout(300);
console.log("pause toggle works:", await p.locator(".dmo-listen").evaluate((el) => el.classList.contains("is-paused")));

await p.locator("#demo-coach").getByRole("button", { name: "退屈な夜 — what is な doing?" }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: "/tmp/shots/strip-3-coach.png" });
console.log("active chip:", await p.locator(".dmo-chip-btn.is-active").innerText());

await p.locator("#demo-reviews .dmo-card").click();
await p.waitForTimeout(700);
await p.screenshot({ path: "/tmp/shots/strip-4-review-flipped.png" });
await p.locator("#demo-reviews").getByRole("button", { name: "Know it → next" }).click();
console.log("after next, count:", await p.locator(".dmo-review__count").innerText());

await p.locator("#demo-collect").scrollIntoViewIfNeeded();
await p.waitForTimeout(3200);
await p.screenshot({ path: "/tmp/shots/strip-5-collect.png" });

const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(`${BASE}/`, { waitUntil: "networkidle" });
await m.evaluate(() => document.getElementById("demo")?.scrollIntoView({ behavior: "instant" }));
await m.waitForTimeout(500);
await m.screenshot({ path: "/tmp/shots/mobile-demo.png" });

console.log("console errors:", errors.length ? errors : "none");
await browser.close();
