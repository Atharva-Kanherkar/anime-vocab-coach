import type { N5Script, N5Text } from "../../../shared/n5/contracts";

/**
 * One authoring notation renders both scripts, so romaji and kana can never drift.
 *
 * - Spaces separate display phrases (kept in kana: `わたしは コウセイです。`).
 * - `_` separates words inside a phrase (romaji only: `watashi wa Kousei desu.`).
 * - A standalone は / へ / を word is a particle and reads wa / e / o, as do the
 *   fixed greetings こんにちは / こんばんは.
 * - `^` capitalises a name in romaji.
 * - 。、？！ become . , ? ! in romaji.
 */
const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "o", ん: "n", ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゃ: "ya", ゅ: "yu", ょ: "yo",
};
const DIGRAPH: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo", ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho", しぇ: "she", じゃ: "ja", じゅ: "ju", じょ: "jo", じぇ: "je",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho", ちぇ: "che", ぢゃ: "ja", ぢゅ: "ju", ぢょ: "jo",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo", ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  びゃ: "bya", びゅ: "byu", びょ: "byo", ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo", りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  てぃ: "ti", でぃ: "di", とぅ: "tu", どぅ: "du", ふぁ: "fa", ふぃ: "fi", ふぇ: "fe", ふぉ: "fo",
  うぃ: "wi", うぇ: "we", うぉ: "wo", ゔぁ: "va", ゔぃ: "vi", ゔぇ: "ve", ゔぉ: "vo",
};
const PUNCT: Record<string, string> = { "。": ".", "、": ",", "？": "?", "！": "!" };
const PARTICLE: Record<string, string> = { は: "wa", へ: "e", を: "o" };
/** Fixed greetings whose final は is historically the particle. */
const WORD: Record<string, string> = { こんにちは: "konnichiwa", こんばんは: "konbanwa" };
const KANA_CHAR = /^[ぁ-ゖァ-ヺー]$/;

/** Katakana to hiragana, leaving the long-vowel mark in place. */
export function foldKana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Romanise one word of kana. Throws on characters outside the course inventory. */
export function romaniseWord(word: string): string {
  const kana = foldKana(word);
  if (PARTICLE[kana]) return PARTICLE[kana];
  if (WORD[kana]) return WORD[kana];
  let out = "";
  let geminate = false;
  let afterN = false;
  for (let i = 0; i < kana.length; i++) {
    const c = kana[i];
    if (c === "っ") { geminate = true; afterN = false; continue; }
    if (c === "ー") {
      const vowel = out.match(/[aeiou]$/)?.[0];
      if (!vowel) throw new Error(`Long-vowel mark without a vowel in ${word}`);
      out += vowel; afterN = false; continue;
    }
    let syllable = DIGRAPH[kana.slice(i, i + 2)];
    if (syllable) i++;
    else syllable = BASE[c];
    if (syllable === undefined) throw new Error(`Unsupported character ${c} in ${word}`);
    if (geminate) {
      if (!/^[bcdfghjkmprstvwyz]/.test(syllable)) throw new Error(`Small tsu before ${syllable} in ${word}`);
      out += syllable.startsWith("ch") ? "t" : syllable[0];
      geminate = false;
    }
    if (afterN && /^[aeiouy]/.test(syllable)) out += "'";
    afterN = c === "ん";
    out += syllable;
  }
  if (geminate) throw new Error(`Trailing small tsu in ${word}`);
  return out;
}

function words(source: string): string[] {
  return source.trim().split(/[ _]+/).filter(Boolean);
}

/** Render one source string to both scripts. */
export function render(source: string): N5Text {
  if (!/^[ぁ-ゖァ-ヺー 。、？！_^]+$/.test(source) || !/[ぁ-ゖァ-ヺ]/.test(source))
    throw new Error(`Invalid course source: ${source}`);
  const kana = source.trim().replace(/[_^]/g, "").replace(/ +/g, " ").replace(/([。、？！]) /g, "$1");
  const romaji = words(source).map((token) => {
    const name = token.startsWith("^");
    let out = "";
    let run = "";
    const flush = () => { if (run) { out += (out && !/[ ]$/.test(out) ? " " : "") + romaniseWord(run); run = ""; } };
    for (const c of token.replace(/\^/g, "")) {
      if (PUNCT[c]) { flush(); out += PUNCT[c] + " "; }
      else if (KANA_CHAR.test(c)) run += c;
      else throw new Error(`Invalid course source: ${source}`);
    }
    flush();
    out = out.trim();
    return name ? out.charAt(0).toUpperCase() + out.slice(1) : out;
  }).join(" ").replace(/ +([.,?!])/g, "$1").replace(/ +/g, " ").trim();
  return { romaji, kana };
}

export function rendered(source: string, script: N5Script): string { return render(source)[script]; }

/** Kana spoken by text-to-speech: no display spacing. */
export function speechText(source: string): string { return render(source).kana.replace(/ /g, ""); }

const KANA_NOISE = /[\s。、.,!?！？「」『』()（）・〜~:：…"'’‘“”-]/g;
const ROMAJI_NOISE = /[.,!?"“”():;~]/g;

/**
 * A lenient comparison key for typed answers. It forgives formatting, never meaning:
 * case, spacing, punctuation, macrons, long-vowel spelling, IME particle spellings
 * (ha/wo/he), Kunrei spellings and katakana/hiragana choice.
 */
export function looseKey(text: string, script: N5Script): string {
  const normalized = text.normalize("NFKC");
  if (script === "kana") return foldKana(normalized).replace(KANA_NOISE, "");
  let s = normalized.toLowerCase()
    .replace(/[āâ]/g, "aa").replace(/[īî]/g, "ii").replace(/[ūû]/g, "uu").replace(/[ēê]/g, "ee").replace(/[ōô]/g, "ou")
    .replace(/[’‘'`-]/g, "").replace(ROMAJI_NOISE, " ");
  s = s.split(/\s+/).filter(Boolean).map((w) => (w === "ha" ? "wa" : w === "wo" ? "o" : w === "he" ? "e" : w)).join("");
  s = s.replace(/si/g, "shi").replace(/ti/g, "chi").replace(/tu/g, "tsu").replace(/(?<![sc])hu/g, "fu")
    .replace(/zi/g, "ji").replace(/sy/g, "sh").replace(/ty/g, "ch").replace(/[zj]y/g, "j");
  let previous = "";
  while (previous !== s) {
    previous = s;
    s = s.replace(/ou|oo/g, "o").replace(/uu/g, "u").replace(/aa/g, "a").replace(/ii/g, "i").replace(/ee|ei/g, "e").replace(/nn/g, "n");
  }
  return s;
}

export function looselyEqual(answer: string, reference: string, script: N5Script): boolean {
  const key = looseKey(answer, script);
  return key.length > 0 && key === looseKey(reference, script);
}

/** Stable, non-secret 64-bit content id (cyrb53 halves). Not a security boundary. */
export function clipId(seed: string): string {
  const half = (salt: number) => {
    let h1 = 0xdeadbeef ^ salt, h2 = 0x41c6ce57 ^ salt;
    for (let i = 0; i < seed.length; i++) {
      const ch = seed.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 >>> 0).toString(16).padStart(8, "0");
  };
  return half(1) + half(2);
}
