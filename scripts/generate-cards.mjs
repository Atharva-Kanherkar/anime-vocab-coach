#!/usr/bin/env node
// Batch-generate collectible card art with OpenAI gpt-image-2.
//
// Reads the card manifest (web/src/lib/cards.ts — Node ≥23.6 strips TS types
// natively), builds one structured prompt per card (constant style block +
// per-card `look` + rarity palette + rotating composition axes), saves PNGs to
// web/public/cards/<id>.png, and updates web/src/lib/cards-art.ts so the app
// picks the art up with zero manual wiring.
//
// Usage:
//   OPENAI_API_KEY=sk-... node scripts/generate-cards.mjs [flags]
// Flags:
//   --dry-run            print prompts, no API calls
//   --limit N            generate at most N cards (default: all missing)
//   --only id,id2        only these card ids
//   --rarity N|R|SR|SSR|UR
//   --force              regenerate even if the PNG already exists
//   --quality low|medium|high   (default high — this is shipping art)
//   --concurrency N      parallel requests (default 2)
//   --model NAME         (default gpt-image-2)

import { mkdir, writeFile, access, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, STYLE_FAMILIES } from "../web/src/lib/cards.ts";

const execFileAsync = promisify(execFile);

// Downscale + WebP the raw PNG so we ship ~50KB cards, not ~2MB. Requires
// `cwebp` (libwebp) on PATH; falls back to the raw PNG if it's missing.
async function toWebp(pngPath, id) {
  const webpPath = path.join(OUT_DIR, `${id}.webp`);
  try {
    await execFileAsync("cwebp", ["-quiet", "-resize", "512", "0", "-q", "80", pngPath, "-o", webpPath]);
    await rm(pngPath, { force: true });
    return `/cards/${id}.webp`;
  } catch {
    return `/cards/${id}.png`; // cwebp unavailable — keep the PNG
  }
}

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "web/public/cards");
const ART_MAP_FILE = path.join(ROOT, "web/src/lib/cards-art.ts");
const LOG_FILE = path.join(OUT_DIR, "prompts.json");

// ---------------------------------------------------------------------------
// Prompt assembly. STYLE is constant across the whole set (coherence);
// look/palette/composition vary per card (distinctness).
// ---------------------------------------------------------------------------

// Rarity → intensity flourish layered on top of the family's own style/palette.
const RARITY_FX = {
  N: "",
  R: "Slightly more detailed rendering and a bit of background flair.",
  SR: "Rich detail, dramatic lighting, and a dynamic hero pose.",
  SSR: "Spectacular full splash-art: dynamic action, motion, and radiating energy. This is a showcase card.",
  UR: "Epic god-tier centerpiece: ornate, majestic, near-symmetrical iconography with a luminous backdrop. The rarest card in the set.",
};

// Composition axes rotate deterministically by card index so no two cards
// share framing + facing + backdrop treatment.
const FRAMING = [
  "bust portrait, subject fills most of the frame",
  "waist-up portrait with room above the head",
  "three-quarter body shot, slight low angle",
  "full-figure shot in the middle distance",
];
const FACING = ["facing slightly left", "facing slightly right", "facing the viewer head-on", "in profile"];
const BACKDROP = [
  "background: a large simple disk (sun or moon) behind the subject",
  "background: a spare atmospheric setting that fits the character, kept uncluttered",
  "background: a bold single-color field so the character pops",
  "background: a suggested environment, softly out of focus behind the subject",
];

const CONSTRAINTS = `Absolutely NO text, NO letters, NO kanji, NO numbers, NO logo,
NO watermark, NO speech bubbles, NO card frame, NO border — full-bleed 2D anime
artwork only (the app draws the frame and title on top). Exactly ONE main
character/subject. Hand-drawn 2D illustration, not 3D render, not a photograph.
Keep the top 12% and bottom 18% of the image relatively simple and low-detail
(UI bars overlay those areas).`;

function buildPrompt(card, index, safe = false) {
  const fam = STYLE_FAMILIES[card.style];
  return [
    safe && fam.styleSafe ? fam.styleSafe : fam.style,
    `Subject: ${card.look}. This is an ORIGINAL character (mood: "${card.epithet}") — do NOT depict any real, existing, or trademarked character; only borrow the general art style.`,
    `Composition: ${FRAMING[index % FRAMING.length]}, ${FACING[index % FACING.length]}, ${BACKDROP[index % BACKDROP.length]}.`,
    RARITY_FX[card.rarity],
    CONSTRAINTS,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------

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

async function exists(p) {
  return access(p).then(() => true, () => false);
}

async function generate({ model, prompt, quality }) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1536", // portrait; the 5:7 card frame center-crops via object-cover
      quality,
      output_format: "png",
      moderation: "low",
    }),
  });
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
  // Merge with whatever is on disk (idempotent, preserves hand edits).
  const current = { ...(await import(ART_MAP_FILE)).CARD_ART, ...entries };
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  const body = Object.entries(sorted)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`)
    .join("\n");
  await writeFile(
    ART_MAP_FILE,
    `// AUTO-MANAGED by scripts/generate-cards.mjs — maps card id → art path under\n` +
      `// /public. Cards without an entry render the typographic placeholder.\n` +
      `// Safe to hand-edit (the generator merges, never clobbers other ids).\n` +
      `export const CARD_ART: Record<string, string> = {\n${body}\n};\n`
  );
}

async function main() {
  const args = parseArgs();
  const model = args.model ?? "gpt-image-2";
  const quality = args.quality ?? "high";
  const concurrency = Math.max(1, parseInt(args.concurrency ?? "2", 10));
  const only = args.only ? new Set(args.only.split(",")) : null;

  let queue = CARDS.map((card) => ({ card, index: CARDS.indexOf(card) }));
  if (only) queue = queue.filter(({ card }) => only.has(card.id));
  if (args.rarity) queue = queue.filter(({ card }) => card.rarity === args.rarity);
  if (args.force !== "true") {
    const checks = await Promise.all(queue.map(({ card }) => exists(path.join(OUT_DIR, `${card.id}.png`))));
    queue = queue.filter((_, i) => !checks[i]);
  }
  if (args.limit) queue = queue.slice(0, parseInt(args.limit, 10));

  if (queue.length === 0) {
    console.log("Nothing to generate (all requested cards already have art — use --force to redo).");
    return;
  }

  if (args.dryRun === "true") {
    for (const { card, index } of queue) {
      console.log(`\n━━━ ${card.id} (${card.rarity}, LV ${card.level}) ━━━\n${buildPrompt(card, index)}`);
    }
    console.log(`\n${queue.length} prompts. Run without --dry-run to generate.`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY first.");
  await mkdir(OUT_DIR, { recursive: true });

  console.log(`Generating ${queue.length} cards with ${model} (quality: ${quality})…`);
  const log = [];
  const done = {};
  let cursor = 0;
  let failed = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (cursor < queue.length) {
        const { card, index } = queue[cursor++];
        try {
          console.log(`→ ${card.id} (${card.rarity})`);
          let png;
          try {
            png = await generateWithRetry({ model, prompt: buildPrompt(card, index), quality }, card.id);
          } catch (err) {
            // Named-franchise prompts can trip moderation — fall back to the
            // brand-free rephrase if the family has one.
            const blocked = err.status === 400 && /moderation|safety|rejected/i.test(err.message);
            if (!blocked || !STYLE_FAMILIES[card.style].styleSafe) throw err;
            console.log(`  ${card.id}: moderation block — retrying brand-free`);
            png = await generateWithRetry({ model, prompt: buildPrompt(card, index, true), quality }, card.id);
          }
          const pngPath = path.join(OUT_DIR, `${card.id}.png`);
          await writeFile(pngPath, png);
          done[card.id] = await toWebp(pngPath, card.id);
          log.push({ id: card.id, rarity: card.rarity, style: card.style });
          console.log(`✓ ${card.id} saved (${done[card.id].endsWith(".webp") ? "webp" : "png"})`);
        } catch (err) {
          failed++;
          console.error(`✗ ${card.id}: ${err.message}`);
        }
      }
    })
  );

  if (Object.keys(done).length > 0) {
    await updateArtMap(done);
    await writeFile(LOG_FILE, JSON.stringify(log, null, 2));
  }
  console.log(
    `\nDone: ${Object.keys(done).length} generated, ${failed} failed.` +
      `\nArt map updated (web/src/lib/cards-art.ts) — build & deploy to ship.`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
