#!/usr/bin/env node
/**
 * Builds extension/data/dictionary.json from JMdict (English variant).
 *
 * Usage:
 *   node scripts/build-dictionary.mjs            # downloads JMdict_e.gz if not present
 *   node scripts/build-dictionary.mjs --jlpt     # additionally overlays real JLPT levels
 *                                                # from scripts/jlpt/n5.txt .. n1.txt
 *                                                # (one word per line; OPTIONAL — script
 *                                                # works fine without these files)
 *
 * Output format (see docs/02-DATA-MODEL.md §1):
 *   { "<written form>": { r: "<hiragana reading>", g: [glosses...], l: 1..5, f: freqRank } }
 *
 * Only entries carrying a JMdict priority tag are kept (news1/2, ichi1/2, spec1/2,
 * gai1/2, nfXX). This yields ~15-25k common words — exactly what we want.
 *
 * No dependencies. Node 18+.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_GZ = join(ROOT, "JMdict_e.gz");
const OUT = join(ROOT, "extension", "data", "dictionary.json");
const URL = "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz";

async function getXml() {
  if (!existsSync(SRC_GZ)) {
    console.log(`Downloading ${URL} ...`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}. Download it manually and place JMdict_e.gz in the repo root.`);
    writeFileSync(SRC_GZ, Buffer.from(await res.arrayBuffer()));
  }
  console.log("Decompressing...");
  return gunzipSync(readFileSync(SRC_GZ)).toString("utf8");
}

const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

const decodeEntities = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function freqFromPris(pris) {
  let best = Infinity;
  for (const p of pris) {
    const m = /^nf(\d\d)$/.exec(p);
    if (m) best = Math.min(best, parseInt(m[1], 10) * 500 - 250);
  }
  // nf ranks are newspaper-derived and undervalue everyday speech (食べる lands
  // at nf25!). The curated tags mark common colloquial words, so they CAP the rank.
  const caps = { ichi1: 3000, spec1: 5000, gai1: 5000, news1: 10000 };
  for (const [tag, cap] of Object.entries(caps)) if (pris.includes(tag)) best = Math.min(best, cap);
  if (best !== Infinity) return best;
  if (pris.some((p) => /^(ichi|news|spec|gai)2$/.test(p))) return 20000;
  return null; // no priority → excluded
}

const levelFromFreq = (f) => (f < 1500 ? 5 : f < 4000 ? 4 : f < 9000 ? 3 : f < 18000 ? 2 : 1);

function main(xml, useJlpt) {
  const dict = {};
  let entries = 0, kept = 0;

  // JMdict is one <entry> per block; split is far faster than real XML parsing
  // and safe because JMdict never nests entries.
  for (const block of xml.split("</entry>")) {
    const start = block.indexOf("<entry>");
    if (start === -1) continue;
    const e = block.slice(start);
    entries++;

    const keb = /<keb>([^<]+)<\/keb>/.exec(e)?.[1] ?? null;
    const reb = /<reb>([^<]+)<\/reb>/.exec(e)?.[1] ?? null;
    if (!reb) continue;

    const pris = [...e.matchAll(/<(?:ke|re)_pri>([^<]+)<\/(?:ke|re)_pri>/g)].map((m) => m[1]);
    const f = freqFromPris(pris);
    if (f === null) continue;

    const glosses = [...e.matchAll(/<gloss[^>]*>([^<]+)<\/gloss>/g)]
      .map((m) => decodeEntities(m[1]))
      .slice(0, 4);
    if (glosses.length === 0) continue;

    const rePris = [...e.matchAll(/<re_pri>([^<]+)<\/re_pri>/g)].map((m) => m[1]);
    const entry = { r: kataToHira(reb), g: glosses, l: levelFromFreq(f), f };

    const primaryKey = keb ?? reb;
    if (!dict[primaryKey] || dict[primaryKey].f > f) dict[primaryKey] = entry;

    // Kana form is itself common (e.g. きれい) → key it by kana too.
    if (keb && rePris.length > 0 && !dict[reb]) dict[reb] = entry;
    kept++;
  }

  if (useJlpt) {
    let overlaid = 0;
    for (const level of [5, 4, 3, 2, 1]) {
      const path = join(ROOT, "scripts", "jlpt", `n${level}.txt`);
      if (!existsSync(path)) { console.log(`(no ${path} — skipping N${level} overlay)`); continue; }
      for (const raw of readFileSync(path, "utf8").split("\n")) {
        const w = raw.trim();
        if (w && dict[w]) { dict[w].l = level; overlaid++; }
      }
    }
    console.log(`JLPT overlay applied to ${overlaid} entries.`);
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(dict));
  const mb = (JSON.stringify(dict).length / 1e6).toFixed(1);
  console.log(`Parsed ${entries} JMdict entries → kept ${kept} prioritized senses → ${Object.keys(dict).length} keys (${mb} MB)`);
  console.log(`Wrote ${OUT}`);

  // Sanity checks — fail loudly rather than ship a broken dictionary.
  const mustHave = ["食べる", "学校", "行く", "面白い"];
  for (const w of mustHave) {
    if (!dict[w]) throw new Error(`Sanity check failed: "${w}" missing from dictionary — parsing is broken.`);
  }
  console.log(`Sanity check OK (${mustHave.join(", ")} all present). Example:`, JSON.stringify(dict["食べる"]));
}

const xml = await getXml();
main(xml, process.argv.includes("--jlpt"));
