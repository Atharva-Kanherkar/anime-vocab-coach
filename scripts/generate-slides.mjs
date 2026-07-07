#!/usr/bin/env node
// One-off: generate hero-slide background art (gpt-image-2, 1536x1024) from
// Fable's art-directed prompts, then downscale to WebP for /public/slides/ and
// a mobile/ copy. Usage: OPENAI_API_KEY=... node scripts/generate-slides.mjs
import { writeFile, mkdir, copyFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "web/public/slides");

const COMMON_TAIL =
  " Landscape 3:2. Absolutely no text, letters, kanji, numbers, logos, watermarks, or UI elements.";

const SLIDES = [
  {
    id: "10-coach",
    prompt:
      "Cinematic anime key visual, painterly hand-painted background art in the style of a prestige anime film — not a photo, not a 3D render. A quiet mountain path at night wrapped in soft drifting mist. In the lower-left foreground, an old moss-covered stone lantern glows with warm persimmon-amber light (#e0603a); beside it sits a small white fox spirit with a faintly luminous tail, calm and watchful, gazing out across the valley — a gentle, wise guide, small in frame. A few delicate threads of golden light rise from the lantern along the left edge, like floating strands of meaning. Everything else is a vast deep indigo-navy night sky (#2c4a68 falling to near-black) over layered distant mountain silhouettes with sparse soft stars. The center of the image is open, dark, low-contrast empty sky — all visual interest stays in the lower-left corner and along the bottom edge. Volumetric mist, atmospheric depth, serene and emotional." +
      COMMON_TAIL,
  },
  {
    id: "11-cards",
    prompt:
      "Cinematic anime key visual, painterly hand-painted digital illustration — not a photo, not a 3D render. A dark, minimalist, dreamlike void of deep indigo-navy sinking to near-black (#2c4a68 to black), like a night sky underwater. Five or six elegant trading-card-shaped rectangles float weightlessly, scattered across the bottom edge and lower corners at gentle tilted angles, receding in size into the dark. Each card is a slim dark slab with a thin glowing gilded border and a blank, softly luminous face — pure gradients of persimmon-amber (#e0603a) and violet light, with no pictures, no symbols, and no writing on any card. Fine golden dust motes and tiny sparkles drift around the lowest cards; one card near the bottom-center catches a brighter warm rim-light. The upper two-thirds and center of the frame stay nearly empty — a smooth dark gradient with only the faintest nebula haze. Premium, tasteful, mysterious, uncluttered." +
      COMMON_TAIL,
  },
  {
    id: "12-manga",
    prompt:
      "Cinematic anime key visual, painterly hand-painted background art in the style of a prestige anime film — not a photo, not a 3D render. At the bottom-center of frame, an open manga volume rests on a dark wooden floor at night, its pages glowing softly with warm persimmon-amber light (#e0603a) as if the story inside is awakening. Rising from the open pages along the bottom edge and lower corners: loose black ink brushstrokes, monochrome screentone fragments, tiny paper-white petals, and a small flock of ink-drawn birds, all dissolving and fading as they lift into a vast deep indigo-navy night (#2c4a68 falling to near-black) that fills the upper two-thirds of the frame. The center of the image stays dark, smooth, and low-contrast — only faint drifting ink motes and mist. All bright detail hugs the bottom of the frame. Magical, quiet, atmospheric, emotional. The manga pages show only abstract blurred panel shapes and screentone — absolutely no readable text, letters, kanji, numbers, logos, or watermarks anywhere." +
      COMMON_TAIL,
  },
];

async function gen(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-2", prompt, n: 1, size: "1536x1024", quality: "high", output_format: "png", moderation: "low" }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  return Buffer.from((await res.json()).data[0].b64_json, "base64");
}

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY");
  await mkdir(path.join(OUT, "mobile"), { recursive: true });
  for (const s of SLIDES) {
    console.log(`→ ${s.id}`);
    const png = path.join(OUT, `${s.id}.png`);
    await writeFile(png, await gen(s.prompt));
    const webp = path.join(OUT, `${s.id}.webp`);
    await execFileAsync("cwebp", ["-quiet", "-resize", "1600", "0", "-q", "82", png, "-o", webp]);
    await copyFile(webp, path.join(OUT, "mobile", `${s.id}.webp`));
    await execFileAsync("rm", ["-f", png]);
    console.log(`✓ ${s.id}.webp (+ mobile copy)`);
  }
  console.log("done");
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
