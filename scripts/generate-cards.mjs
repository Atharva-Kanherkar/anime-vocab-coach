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

import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "../web/src/lib/cards.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "web/public/cards");
const ART_MAP_FILE = path.join(ROOT, "web/src/lib/cards-art.ts");
const LOG_FILE = path.join(OUT_DIR, "prompts.json");

// ---------------------------------------------------------------------------
// Prompt assembly. STYLE is constant across the whole set (coherence);
// look/palette/composition vary per card (distinctness).
// ---------------------------------------------------------------------------

const STYLE = `Flat risograph screen-print illustration in a modern anime style.
Bold clean linework in warm black ink, minimal cel shading, visible print
texture and slight ink misregistration. Japanese graphic-design poster
sensibility: strong silhouette, decisive negative space, flat shapes only.`;

// Rarity → strict palette instruction (escalates with rarity).
const PALETTE = {
  N: "Strict two-color print: cream paper background #f5efe0 with ONE ink only — either deep indigo #2c4a68 or vermillion #d84e2a — plus warm black line art.",
  R: "Strict three-color print: cream paper background #f5efe0, vermillion #d84e2a AND deep indigo #2c4a68 inks, warm black line art.",
  SR: "Three-color print on cream #f5efe0 with vermillion #d84e2a and indigo #2c4a68, heavier pattern work: halftone dots, hatching, or stripe screentones in the background.",
  SSR: "Full riso palette on cream #f5efe0 — vermillion #d84e2a, indigo #2c4a68, warm black — with a dramatic dynamic composition: motion, wind, weather, or radiating lines.",
  UR: "Inverted print: warm black paper background, character rendered in cream #f5efe0 and vermillion #d84e2a inks with fine indigo accents. Majestic, symmetrical, iconographic.",
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
  "backdrop: one large flat sun/moon disk behind the subject",
  "backdrop: flat horizontal bands suggesting sky and ground",
  "backdrop: sparse hand-cut paper clouds",
  "backdrop: a field of small repeated print motifs (dots, seals, or crests)",
  "backdrop: plain paper with a single bold diagonal ink band",
];

const CONSTRAINTS = `Absolutely NO text, NO letters, NO kanji, NO numbers, NO logo,
NO watermark, NO card frame, NO border — full-bleed artwork only (the app draws
the frame and title). Exactly ONE character/subject. No gradients, no photo
texture, no 3D rendering. Keep the top 12% and bottom 18% of the image simple
and low-detail (UI bars overlay those areas).`;

function buildPrompt(card, index) {
  return [
    STYLE,
    `Character: ${card.look}. Mood inspired by the epithet "${card.epithet}" — an original character, not from any existing anime.`,
    `Composition: ${FRAMING[index % FRAMING.length]}, ${FACING[index % FACING.length]}, ${BACKDROP[index % BACKDROP.length]}.`,
    PALETTE[card.rarity],
    CONSTRAINTS,
  ].join("\n\n");
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
        const prompt = buildPrompt(card, index);
        try {
          console.log(`→ ${card.id} (${card.rarity})`);
          const png = await generateWithRetry({ model, prompt, quality }, card.id);
          await writeFile(path.join(OUT_DIR, `${card.id}.png`), png);
          done[card.id] = `/cards/${card.id}.png`;
          log.push({ id: card.id, rarity: card.rarity, prompt });
          console.log(`✓ ${card.id} saved (${Math.round(png.length / 1024)} KB)`);
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
