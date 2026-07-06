#!/usr/bin/env node
// Batch-generate manga panel art with OpenAI gpt-image-2.
//
// Reads the chapter manifest (web/src/lib/manga/chapters.ts — Node ≥23.6 strips
// TS types natively), builds one prompt per panel (constant manga style block +
// per-panel artPrompt), and — for character consistency — seeds each panel via
// the IMAGE EDITS endpoint with the existing card art of the panel's `cast`
// (up to 16 reference images). Panels with no known cast fall back to plain
// text-to-image generation. Saves PNGs → WebP to web/public/manga/<id>.webp and
// updates web/src/lib/manga-art.ts so the app picks the art up automatically.
//
// Balloons are drawn EMPTY on purpose — dialogue is overlaid as real UI text
// (JA/romaji/EN toggle). See docs/manga/IMAGE_PIPELINE.md.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generate-manga.mjs [flags]
// Flags:
//   --dry-run            print prompts, no API calls
//   --only id,id2        only these panel ids (e.g. ch1_p1,ch1_p3)
//   --chapter ch1        only panels in this chapter id
//   --force              regenerate even if the WebP already exists
//   --quality low|medium|high   (default high)
//   --concurrency N      parallel requests (default 2 — respect rate limits)
//   --model NAME         (default gpt-image-2)

import { mkdir, writeFile, access, rm, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTERS } from "../web/src/lib/manga/chapters.ts";

const execFileAsync = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "web/public/manga");
const CARDS_DIR = path.join(ROOT, "web/public/cards");
const ART_MAP_FILE = path.join(ROOT, "web/src/lib/manga-art.ts");
const LOG_FILE = path.join(OUT_DIR, "prompts.json");

// One coherent look across the whole saga: black-and-white screentone manga.
// White speech balloons on B&W art keep the overlaid text perfectly legible,
// and a single spot color (named per panel) carries the supernatural beats.
const STYLE = `Black-and-white Japanese manga page art. Screentone shading, dramatic sumi ink brushwork, bold confident linework, high contrast, cinematic dynamic composition. Emotive, serialized-shonen quality. Use a SINGLE restrained spot color ONLY where the scene names one (e.g. a green Hush-glow, a colored thread of light); everything else stays monochrome.`;

const SIZE = { portrait: "1024x1536", landscape: "1536x1024", square: "1024x1024", spread: "1536x1024" };

const RULES = `Draw any speech balloons and caption boxes EMPTY — no text inside them (dialogue is added later). Do NOT add page numbers, credits, borders around the whole image, or a manga logo. No signature, no watermark. Short stylized Japanese sound-effect characters are allowed only if the scene explicitly names them.`;

function buildPrompt(panel) {
  return [STYLE, `PANEL: ${panel.artPrompt}`, RULES].join("\n\n");
}

async function toWebp(pngPath, id) {
  const webpPath = path.join(OUT_DIR, `${id}.webp`);
  try {
    await execFileAsync("cwebp", ["-quiet", "-resize", "1024", "0", "-q", "82", pngPath, "-o", webpPath]);
    await rm(pngPath, { force: true });
    return `/manga/${id}.webp`;
  } catch {
    // cwebp (libwebp) unavailable — fall back to ImageMagick.
    try {
      await execFileAsync("magick", [pngPath, "-resize", "1024x>", "-quality", "82", webpPath]);
      await rm(pngPath, { force: true });
      return `/manga/${id}.webp`;
    } catch {
      return `/manga/${id}.png`; // no converter — keep the PNG
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const [k, inlineV] = a.slice(2).split("=");
    const key = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = args[i + 1];
    out[key] = inlineV ?? (next && !next.startsWith("--") ? args[++i] : "true");
  }
  return out;
}

const exists = (p) => access(p).then(() => true, () => false);

// Resolve the on-disk card art for a cast id (webp preferred, png fallback).
async function refImageFor(cardId) {
  for (const ext of ["webp", "png"]) {
    const p = path.join(CARDS_DIR, `${cardId}.${ext}`);
    if (await exists(p)) return { path: p, ext };
  }
  return null;
}

async function generate({ model, prompt, size, quality, refs }) {
  let url, headers, body;

  if (refs.length > 0) {
    // Character-consistent composition via the edits endpoint (multipart).
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", quality);
    form.append("n", "1");
    for (const r of refs) {
      const buf = await readFile(r.path);
      const type = r.ext === "png" ? "image/png" : "image/webp";
      form.append("image[]", new Blob([buf], { type }), path.basename(r.path));
    }
    url = "https://api.openai.com/v1/images/edits";
    headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` };
    body = form;
  } else {
    // No reference art — plain text-to-image (JSON only).
    url = "https://api.openai.com/v1/images/generations";
    headers = {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };
    body = JSON.stringify({ model, prompt, size, quality, n: 1, output_format: "png", moderation: "low" });
  }

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`${res.status} ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function generateWithRetry(opts, id) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await generate(opts);
    } catch (err) {
      const retryable = err.status === 429 || err.status >= 500;
      if (!retryable || attempt >= 3) throw err;
      const wait = attempt * 15_000;
      console.log(`  ${id}: ${err.status} — retrying in ${wait / 1000}s (${attempt}/2)`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function updateArtMap(entries) {
  const current = { ...(await import(ART_MAP_FILE)).MANGA_ART, ...entries };
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  const body = Object.entries(sorted).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n");
  await writeFile(
    ART_MAP_FILE,
    `// AUTO-MANAGED by scripts/generate-manga.mjs — maps manga panel id → art path\n` +
      `// under /public/manga. Panels without an entry render a typographic placeholder.\n` +
      `// Safe to hand-edit (the generator merges, never clobbers other ids).\n` +
      `export const MANGA_ART: Record<string, string> = {\n${body}\n};\n`
  );
}

async function main() {
  const args = parseArgs();
  const model = args.model ?? "gpt-image-2";
  const quality = args.quality ?? "high";
  const concurrency = Math.max(1, parseInt(args.concurrency ?? "2", 10));
  const only = args.only ? new Set(args.only.split(",")) : null;

  let panels = CHAPTERS.flatMap((ch) => ch.panels.map((p) => ({ ...p, chapterId: ch.id })));
  if (args.chapter) panels = panels.filter((p) => p.chapterId === args.chapter);
  if (only) panels = panels.filter((p) => only.has(p.id));
  if (args.force !== "true") {
    const checks = await Promise.all(panels.map((p) => exists(path.join(OUT_DIR, `${p.id}.webp`))));
    panels = panels.filter((_, i) => !checks[i]);
  }

  if (panels.length === 0) {
    console.log("Nothing to generate (all requested panels already have art — use --force to redo).");
    return;
  }

  // Resolve reference card art per panel (only ids that actually have art).
  for (const p of panels) {
    const resolved = await Promise.all((p.cast ?? []).map(refImageFor));
    p.refs = resolved.filter(Boolean).slice(0, 16);
  }

  if (args.dryRun === "true") {
    for (const p of panels) {
      console.log(`\n━━━ ${p.id} (${p.aspect}, refs: ${p.refs.map((r) => path.basename(r.path)).join(",") || "none"}) ━━━\n${buildPrompt(p)}`);
    }
    console.log(`\n${panels.length} panels. Run without --dry-run to generate.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY first.");
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Generating ${panels.length} manga panels with ${model} (quality: ${quality})…`);
  const log = [];
  const done = {};
  let cursor = 0;
  let failed = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, panels.length) }, async () => {
      while (cursor < panels.length) {
        const p = panels[cursor++];
        try {
          console.log(`→ ${p.id} (${p.refs.length} refs)`);
          const png = await generateWithRetry(
            { model, prompt: buildPrompt(p), size: SIZE[p.aspect] ?? SIZE.portrait, quality, refs: p.refs },
            p.id
          );
          const pngPath = path.join(OUT_DIR, `${p.id}.png`);
          await writeFile(pngPath, png);
          done[p.id] = await toWebp(pngPath, p.id);
          log.push({ id: p.id, aspect: p.aspect, refs: p.refs.map((r) => path.basename(r.path)) });
          console.log(`✓ ${p.id} saved`);
        } catch (err) {
          failed++;
          console.error(`✗ ${p.id}: ${err.message}`);
        }
      }
    })
  );

  if (Object.keys(done).length > 0) {
    await updateArtMap(done);
    await writeFile(LOG_FILE, JSON.stringify(log, null, 2));
  }
  console.log(`\nDone: ${Object.keys(done).length} generated, ${failed} failed.\nArt map updated (web/src/lib/manga-art.ts).`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
