#!/usr/bin/env node
/**
 * Compare Whisper transcription across providers on local WAV clips.
 *
 * Usage:
 *   node scripts/benchmark-transcribe.mjs --clips backend/benchmarks/clips --language ja
 *   node scripts/benchmark-transcribe.mjs --clips backend/benchmarks/clips --providers openai
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";

const PROVIDERS = {
  openai: {
    url: "https://api.openai.com/v1/audio/transcriptions",
    key: () => process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_WHISPER_MODEL || "whisper-1"
  },
  groq: {
    url: "https://api.groq.com/openai/v1/audio/transcriptions",
    key: () => process.env.GROQ_API_KEY,
    model: process.env.GROQ_WHISPER_MODEL || "whisper-large-v3"
  },
  deepinfra: {
    url: "https://api.deepinfra.com/v1/openai/audio/transcriptions",
    key: () => process.env.DEEPINFRA_API_KEY,
    model: process.env.DEEPINFRA_WHISPER_MODEL || "openai/whisper-large-v3"
  }
};

function parseArgs(argv) {
  const args = { clips: "backend/benchmarks/clips", language: "ja", providers: "openai,groq,deepinfra", out: "backend/benchmarks/results.json" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--clips") args.clips = argv[++i];
    else if (argv[i] === "--language") args.language = argv[++i];
    else if (argv[i] === "--providers") args.providers = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

async function transcribe(providerName, wavPath, language) {
  const def = PROVIDERS[providerName];
  if (!def) throw new Error("unknown provider: " + providerName);
  const key = def.key();
  if (!key) return { skipped: true, reason: "API key not set" };

  const buf = await readFile(wavPath);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "audio/wav" }), basename(wavPath));
  form.append("model", def.model);
  form.append("language", language);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const t0 = Date.now();
  const res = await fetch(def.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + key },
    body: form
  });
  const ms = Date.now() - t0;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error?.message || res.status, latencyMs: ms };
  }
  return {
    text: data.text || "",
    segments: (data.segments || []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
    latencyMs: ms
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const names = args.providers.split(",").map((s) => s.trim()).filter(Boolean);
  let files;
  try {
    files = (await readdir(args.clips)).filter((f) => f.endsWith(".wav")).sort();
  } catch {
    console.error("No clips directory:", args.clips);
    console.error("Create it and add 60s WAV files — see backend/benchmarks/QUALITY_GATE.md");
    process.exit(1);
  }
  if (!files.length) {
    console.error("No .wav files in", args.clips);
    process.exit(1);
  }

  const results = { generatedAt: new Date().toISOString(), language: args.language, clips: {} };

  for (const file of files) {
    const path = join(args.clips, file);
    results.clips[file] = {};
    for (const name of names) {
      process.stdout.write(`${file} → ${name}... `);
      try {
        results.clips[file][name] = await transcribe(name, path, args.language);
        console.log(results.clips[file][name].skipped ? "skipped" : results.clips[file][name].error ? "error" : "ok");
      } catch (err) {
        results.clips[file][name] = { error: String(err.message || err) };
        console.log("fail");
      }
    }
  }

  await mkdir(join(args.out, ".."), { recursive: true }).catch(() => {});
  await writeFile(args.out, JSON.stringify(results, null, 2));
  console.log("\nWrote", args.out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
