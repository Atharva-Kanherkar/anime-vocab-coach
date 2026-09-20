import { chromium } from "playwright";
const browser = await chromium.launch();
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto("http://localhost:3400/", { waitUntil: "networkidle" });
await m.waitForTimeout(800);
const info = await m.evaluate(() => {
  const q = (sel) => document.querySelector(sel);
  const rect = (sel) => {
    const el = q(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      top: Math.round(r.top),
      height: Math.round(r.height),
      display: cs.display,
      justifyContent: cs.justifyContent,
      paddingTop: cs.paddingTop,
      gap: cs.gap,
      aspectRatio: cs.aspectRatio,
    };
  };
  return {
    center: rect(".hero__center.is-active"),
    split: rect(".hero__split"),
    copy: rect(".hero__copy"),
    shot: rect(".shot"),
    scene: rect(".shot__scene"),
    art: rect(".shot__art"),
    hasSupported: CSS.supports("selector(:has(*))"),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
