import { warn } from "./log";
import type { Token } from "../types";

const DIGRAPHS: Record<string, string> = {
  "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
  "しゃ": "sha", "しゅ": "shu", "しょ": "sho", "しぇ": "she",
  "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho", "ちぇ": "che",
  "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
  "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
  "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
  "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
  "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
  "じゃ": "ja", "じゅ": "ju", "じょ": "jo", "じぇ": "je",
  "ぢゃ": "ja", "ぢゅ": "ju", "ぢょ": "jo",
  "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
  "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
  "ふぁ": "fa", "ふぃ": "fi", "ふぇ": "fe", "ふぉ": "fo",
  "てぃ": "ti", "でぃ": "di", "とぅ": "tu", "どぅ": "du",
  "うぃ": "wi", "うぇ": "we", "うぉ": "wo",
  "つぁ": "tsa", "つぃ": "tsi", "つぇ": "tse", "つぉ": "tso",
  "ゔぁ": "va", "ゔぃ": "vi", "ゔぇ": "ve", "ゔぉ": "vo"
};

const MONOGRAPHS: Record<string, string> = {
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
  "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
  "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
  "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
  "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
  "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
  "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
  "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
  "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
  "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
  "や": "ya", "ゆ": "yu", "よ": "yo",
  "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
  "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n", "ゔ": "vu",
  "ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o",
  "ゃ": "ya", "ゅ": "yu", "ょ": "yo", "ゎ": "wa",
  "。": ". ", "、": ", ", "！": "! ", "？": "? ", "・": " ", "「": " \"", "」": "\" "
};

export function kataToHira(s: string): string {
  return (s || "").replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

// Wapuro-style Hepburn: そう → "sou", っち → "tchi", ー doubles the previous vowel.
export function toRomaji(kana: string): string {
  const s = kataToHira(kana);
  let out = "";
  let sokuon = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "っ") { sokuon = true; i++; continue; }
    if (ch === "ー") {
      const m = out.match(/[aiueo](?=[^aiueo]*$)/);
      if (m) out += m[0];
      i++;
      continue;
    }
    let roma: string | null = null;
    const pair = s.slice(i, i + 2);
    if (DIGRAPHS[pair]) { roma = DIGRAPHS[pair]; i += 2; }
    else if (MONOGRAPHS[ch]) { roma = MONOGRAPHS[ch]; i += 1; }
    else { out += ch; i += 1; sokuon = false; continue; } // kanji/latin/punct pass through
    if (sokuon) {
      out += roma.startsWith("ch") ? "t" : roma[0];
      sokuon = false;
    }
    out += roma;
  }
  return out.replace(/\s+/g, " ").trim();
}

export interface SentencePiece {
  text: string;
  highlight: boolean;
}

// Romaji for a full tokenized sentence; highlightIndex wraps that token in markers.
// Returns array of {text, highlight} pieces so callers can build DOM safely.
export function sentencePieces(tokens: Token[], highlightIndex: number): SentencePiece[] {
  return tokens
    .map((t, idx) => ({
      text: toRomaji(t.reading || t.surface),
      highlight: idx === highlightIndex
    }))
    .filter((p) => p.text);
}

export function speak(text: string): void {
  void speakAsync(text);
}

/** Warm up voices so the first Hear click works immediately. */
export function preloadVoices(): void {
  try {
    const synth = window.top?.speechSynthesis ?? speechSynthesis;
    void loadVoices(synth);
  } catch {
    /* ignore */
  }
}

async function speakAsync(raw: string): Promise<void> {
  const text = (raw || "").trim();
  if (!text) return;
  try {
    const synth = window.top?.speechSynthesis ?? speechSynthesis;
    const voices = await loadVoices(synth);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.85;
    const ja =
      voices.find((v) => v.lang === "ja-JP") ||
      voices.find((v) => v.lang?.startsWith("ja")) ||
      null;
    if (ja) u.voice = ja;
    synth.cancel();
    synth.speak(u);
  } catch (err) {
    warn("tts failed:", err);
  }
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const pick = (): SpeechSynthesisVoice[] => synth.getVoices().filter(Boolean);
    const existing = pick();
    if (existing.length) {
      resolve(existing);
      return;
    }
    const done = (): void => {
      synth.removeEventListener("voiceschanged", done);
      resolve(pick());
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", done);
      resolve(pick());
    }, 800);
  });
}
