// Lightweight kana → romaji (Hepburn). User vocab only carries kana `reading`,
// so this is what powers the romaji shown on Today / cards. Handles hiragana,
// katakana, digraphs (きゃ→kya), sokuon (っ→gemination), long vowels (ー / ー),
// and syllabic ん. Kanji or unknown chars pass through unchanged.

const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "o", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o", ゔ: "vu",
};

const DIGRAPH: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pyo",
};

// Katakana → hiragana by codepoint offset, so one table covers both scripts.
function toHira(ch: string): string {
  const c = ch.codePointAt(0)!;
  if (c >= 0x30a1 && c <= 0x30f6) return String.fromCodePoint(c - 0x60);
  return ch;
}

export function kanaToRomaji(input: string): string {
  if (!input) return "";
  const s = Array.from(input).map(toHira).join("");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // long-vowel mark: repeat previous vowel
    if (ch === "ー" || ch === "ｰ") {
      const prev = out.at(-1);
      if (prev && "aeiou".includes(prev)) out += prev;
      i += 1;
      continue;
    }
    // sokuon: double the next consonant
    if (ch === "っ") {
      const nextPair = s.slice(i + 1, i + 3);
      const next = DIGRAPH[nextPair] ?? BASE[s[i + 1]] ?? "";
      if (next) out += next[0];
      i += 1;
      continue;
    }
    const pair = s.slice(i, i + 2);
    if (DIGRAPH[pair]) {
      out += DIGRAPH[pair];
      i += 2;
      continue;
    }
    if (BASE[ch]) {
      out += BASE[ch];
      i += 1;
      continue;
    }
    // kanji / punctuation / latin — pass through
    out += ch;
    i += 1;
  }
  return out;
}

/** "reading" (kana) → "reading · romaji" unless the reading is already latin. */
export function readingWithRomaji(reading: string): string {
  const r = reading?.trim();
  if (!r) return "";
  const romaji = kanaToRomaji(r);
  return romaji && romaji !== r ? `${r} · ${romaji}` : r;
}
