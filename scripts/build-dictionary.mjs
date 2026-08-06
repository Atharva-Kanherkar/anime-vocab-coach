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
import { fileURLToPath, pathToFileURL } from "node:url";

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

/** Collision-resolution rank: [curated tag tier, nf newspaper rank].
 *
 * Two stages because neither signal alone orders homographs correctly:
 * freqFromPris caps nf by tag, flattening 買う (nf10) and 飼う (nf26) into a
 * tie at ichi1's 3000 that decays into file order; raw nf alone lets 入る
 * (いる, ichi1, no nf) beat 入る (はいる, ichi1, nf25) merely because the
 * common form's rank exists. Same tier + an nf rank present beats absent.
 *
 * ichi1 outranks the other *1 tags: it's the everyday-vocabulary list, the
 * best commonness proxy for SPOKEN Japanese, which is what Whisper feeds us.
 * Newspaper-derived tags undervalue speech — 居る (ichi1) must beat 要る
 * (spec1 + nf27) for the kana key いる. */
function claimRankFromPris(pris) {
  const tier = pris.includes("ichi1")
    ? 0
    : pris.some((p) => /^(news|spec|gai)1$/.test(p))
      ? 1
      : pris.some((p) => /^(ichi|news|spec|gai)2$/.test(p))
        ? 2
        : pris.length > 0
          ? 3
          : 4;
  let nf = Infinity;
  for (const p of pris) {
    const m = /^nf(\d\d)$/.exec(p);
    if (m) nf = Math.min(nf, parseInt(m[1], 10));
  }
  return [tier, nf];
}

export function buildDictionary(xml) {
  const dict = {};
  // Per-key claim strength, so homographs are resolved by evidence instead of
  // JMdict file order.
  //
  // Kanji keys: lower claim rank wins; "usually kana" (uk) then tag count
  // break ties. Kana keys: uk wins FIRST, then rank — a kana token most
  // likely means the entry that is usually written in kana. Newspaper nf
  // ranks alone get this wrong (琴 "zither" outranks 事 for こと because 事's
  // kanji form is undercounted in print — it's usually kana).
  const claims = new Map();
  let entries = 0, kept = 0;

  const put = (key, entry, claim) => {
    const prev = claims.get(key);
    const order =
      claim.kind === "kana"
        ? (c) => [c.uk ? 0 : 1, ...c.rank, -c.priCount]
        : (c) => [...c.rank, c.uk ? 0 : 1, -c.priCount];
    let wins = !prev;
    if (prev) {
      const a = order(claim), b = order(prev);
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) { wins = a[i] < b[i]; break; }
      }
    }
    if (wins) {
      dict[key] = entry;
      claims.set(key, claim);
    }
  };

  // JMdict is one <entry> per block; split is far faster than real XML parsing
  // and safe because JMdict never nests entries.
  for (const block of xml.split("</entry>")) {
    const start = block.indexOf("<entry>");
    if (start === -1) continue;
    const e = block.slice(start);
    entries++;

    // ALL writings and readings, each with its own priority tags. The old
    // builder took only the first <keb>/<reb> and pooled every priority tag in
    // the entry, so a rare homograph could claim a key with a common word's
    // frequency — いる shipped as 射る "to shoot an arrow".
    const kEles = [...e.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)]
      .map((m) => ({
        keb: /<keb>([^<]+)<\/keb>/.exec(m[1])?.[1] ?? null,
        pris: [...m[1].matchAll(/<ke_pri>([^<]+)<\/ke_pri>/g)].map((x) => x[1]),
      }))
      .filter((k) => k.keb);
    const rEles = [...e.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)]
      .map((m) => ({
        reb: /<reb>([^<]+)<\/reb>/.exec(m[1])?.[1] ?? null,
        pris: [...m[1].matchAll(/<re_pri>([^<]+)<\/re_pri>/g)].map((x) => x[1]),
        restr: [...m[1].matchAll(/<re_restr>([^<]+)<\/re_restr>/g)].map((x) => x[1]),
        noKanji: m[1].includes("<re_nokanji"),
      }))
      .filter((r) => r.reb);
    if (rEles.length === 0) continue;

    // Keep senses separate. JMdict can restrict a sense to particular written
    // forms/readings; flattening one entry-wide gloss made 録る mean "take a
    // photograph" (a sense explicitly restricted to 撮る).
    const senses = [...e.matchAll(/<sense>([\s\S]*?)<\/sense>/g)]
      .map((sm) => ({
        glosses: [...sm[1].matchAll(/<gloss([^>]*)>([^<]+)<\/gloss>/g)]
          .filter((m) => !m[1].includes("g_type"))
          .map((m) => decodeEntities(m[2]))
          .slice(0, 4),
        stagk: [...sm[1].matchAll(/<stagk>([^<]+)<\/stagk>/g)].map((m) => m[1]),
        stagr: [...sm[1].matchAll(/<stagr>([^<]+)<\/stagr>/g)].map((m) => m[1]),
        info: [...sm[1].matchAll(/<s_inf>([^<]+)<\/s_inf>/g)].map((m) => decodeEntities(m[1])),
      }))
      .filter((sense) => sense.glosses.length > 0);
    if (senses.length === 0) continue;

    const glossesFor = (keb, reb) => {
      const readingApplicable = senses.filter(
        (sense) => sense.stagr.length === 0 || sense.stagr.includes(reb)
      );
      // A kana token cannot reveal which written form the speaker meant. Keep
      // JMdict's first reading-applicable sense as the neutral/default meaning;
      // spelling restrictions are only useful when a written form is known.
      if (keb === null) return (readingApplicable[0] ?? senses[0]).glosses;

      const applicable = readingApplicable.find((sense) => {
        if (sense.stagk.length > 0) return keb !== null && sense.stagk.includes(keb);
        const hintedKebs = kEles
          .map((k) => k.keb)
          .filter((candidate) => sense.info.some((info) => info.includes(candidate)));
        return hintedKebs.length === 0 || (keb !== null && hintedKebs.includes(keb));
      });
      return (applicable ?? readingApplicable[0] ?? senses[0]).glosses;
    };

    // "usually written using kana alone" — the strongest signal that a kana
    // key belongs to this entry.
    const uk = e.includes("&uk;");
    const priCount = kEles.reduce((n, k) => n + k.pris.length, 0) +
      rEles.reduce((n, r) => n + r.pris.length, 0);

    // The reading shown for a written form must actually apply to it
    // (<re_restr> honored) — 入る was shipping with reading いる.
    const readingFor = (keb) =>
      rEles.find((r) => !r.noKanji && (r.restr.length === 0 || r.restr.includes(keb)));

    let keptAny = false;
    for (const k of kEles) {
      const r = readingFor(k.keb);
      if (!r) continue;
      const pris = [...k.pris, ...r.pris];
      const f = freqFromPris(pris);
      if (f === null) continue;
      const glosses = glossesFor(k.keb, r.reb);
      put(
        k.keb,
        { r: kataToHira(r.reb), g: glosses, l: levelFromFreq(f), f },
        { kind: "kanji", rank: claimRankFromPris(pris), uk, priCount }
      );
      keptAny = true;
    }

    // Kana key only when the reading is itself common (carries its own
    // priority tag), scored by the READING's frequency — e.g. きれい, いる.
    for (const r of rEles) {
      if (kEles.length > 0 && r.pris.length === 0) continue;
      const f = freqFromPris(r.pris);
      if (f === null) continue;
      const glosses = glossesFor(null, r.reb);
      put(
        r.reb,
        { r: kataToHira(r.reb), g: glosses, l: levelFromFreq(f), f },
        { kind: "kana", rank: claimRankFromPris(r.pris), uk, priCount }
      );
      keptAny = true;
    }
    if (keptAny) kept++;
  }

  return { dict, entries, kept };
}

function main(xml, useJlpt) {
  const { dict, entries, kept } = buildDictionary(xml);

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

  // Homograph checks: Whisper output is kana-heavy, so these kana keys MUST
  // resolve to the everyday sense. Every one of these shipped wrong at least
  // once (いる was "to shoot an arrow", くる was "to reel thread"…).
  const mustMean = [
    ["いる", /to be \(of animate|to exist/i],
    ["くる", /to come/i],
    ["いく", /to go/i],
    ["みる", /to see|to look|to watch/i],
    ["きる", /to cut|to wear|to put on/i],
    ["かう", /to buy/i],
    ["しる", /to know/i],
    ["こと", /thing|matter/i],
    ["もの", /thing|object/i],
    ["撮る", /photograph/i],
    ["録る", /to record/i],
    ["空ける", /to empty|make space|make room/i],
    ["明ける", /to dawn|grow light|to end/i],
  ];
  for (const [w, re] of mustMean) {
    const entry = dict[w];
    if (!entry) throw new Error(`Sanity check failed: "${w}" missing from dictionary.`);
    if (!re.test(entry.g.join(" "))) {
      throw new Error(`Sanity check failed: "${w}" resolves to the wrong homograph: ${JSON.stringify(entry.g)}`);
    }
  }
  const mustRead = [
    ["人", "ひと"],
    ["入る", "はいる"],
    ["事", "こと"],
  ];
  for (const [w, r] of mustRead) {
    if (dict[w]?.r !== r) {
      throw new Error(`Sanity check failed: "${w}" reads "${dict[w]?.r}", expected "${r}".`);
    }
  }
  console.log(`Sanity check OK (${mustHave.join(", ")} present; ${mustMean.length + mustRead.length} homograph checks). Example:`, JSON.stringify(dict["食べる"]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const xml = await getXml();
  main(xml, process.argv.includes("--jlpt"));
}
