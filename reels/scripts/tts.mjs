#!/usr/bin/env node
// Narrate a reel spec with OpenAI TTS. For each scene without an `audio`
// field, generates public/audio/<spec>-<i>.mp3 and writes the path back into
// the spec, so the renderer times each scene to the narration.
//
//   OPENAI_API_KEY=sk-... node scripts/tts.mjs specs/demo.json [voice]
//
// Voices worth trying: onyx (deep), nova (bright), ash, alloy.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const specPath = process.argv[2];
const voice = process.argv[3] || "onyx";
if (!specPath) {
  console.error("usage: node scripts/tts.mjs specs/<reel>.json [voice]");
  process.exit(1);
}
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

const spec = JSON.parse(readFileSync(specPath, "utf8"));
const slug = basename(specPath).replace(/\.json$/, "");
mkdirSync(join("public", "audio"), { recursive: true });

for (let i = 0; i < spec.scenes.length; i++) {
  const scene = spec.scenes[i];
  if (scene.audio) continue;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: scene.text,
      // Steer delivery — this is what makes it sound like storytime, not a bot.
      instructions:
        "Narrate like a manga storyteller on a reels video: intimate, a little dramatic, unhurried, building suspense.",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    console.error(`scene ${i}: TTS HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const file = `audio/${slug}-${i}.mp3`;
  writeFileSync(join("public", file), Buffer.from(await res.arrayBuffer()));
  scene.audio = file;
  console.log(`scene ${i}: ${file}`);
}

writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
console.log(`updated ${specPath} — render with:\n  npx remotion render MangaReel out/${slug}.mp4 --props=${specPath}`);
