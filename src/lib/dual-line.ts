/**
 * The Japanese half of dual subtitles, as the learner can read it: romaji or
 * kana with spaces between words, or the original line.
 *
 * Tokens are kuromoji's, which cuts finer than a learner reads ("tabe te ita"),
 * so endings join the word they belong to ("tabete ita"), honorifics hang off
 * the name ("Kaori-san"), punctuation sits on the word before it, and the
 * particles は and へ say wa and e. Each piece remembers its first token, the
 * word the subtitle looks up when hovered.
 */
import { kataToHira, toRomaji } from "./romaji";
import type { Token } from "../types";

export type SubScript = "romaji" | "kana" | "kanji";

export interface DualPiece {
  /** What is shown, punctuation included. */
  text: string;
  /** Index of the piece's first token, or -1 for punctuation on its own. */
  token: number;
  /** Token indexes the piece covers. */
  tokens: number[];
  /** Joined to the piece before without a space. */
  attached: boolean;
}

const PUNCT: Record<string, string> = {
  "。": ".", "、": ",", "！": "!", "？": "?", "!": "!", "?": "?", "…": "…", "‥": "…",
  "・": " ", "「": "“", "」": "”", "『": "“", "』": "”", "（": "(", "）": ")",
  "〜": "~", "～": "~", "ー": "-", "―": "-",
};
const HONORIFICS = new Set(["さん", "ちゃん", "くん", "君", "様", "さま", "先輩", "せんぱい", "先生", "せんせい", "殿", "氏"]);
/** です and だ as "is": a word of their own ("takai desu"), unlike the past
 * tense だ of 読んだ, which kuromoji gives the dictionary form た. */
const COPULA = new Set(["です", "だ"]);
const OPENING = new Set(["\u201c", "(", "「", "『", "（"]);

function isPunct(t: Token): boolean {
  return t.pos === "記号" || /^[\s。、！？!?…‥・「」『』（）〜～ー―.,]+$/.test(t.surface);
}

/** Does this token belong to the word before it? */
function joins(t: Token, prev: Token | undefined): boolean {
  if (!prev || isPunct(prev)) return false;
  const inflecting = prev.pos === "動詞" || prev.pos === "形容詞" || prev.pos === "助動詞";
  // だ after a sound-changed verb stem is the past tense (読んだ, 泳いだ).
  if (t.pos === "助動詞") return inflecting && (!COPULA.has(t.base) || (prev.pos === "動詞" && /[んい]$/.test(prev.surface)));
  // てる, ちゃう, とく: contracted helpers that are spoken as one word with the verb.
  if (t.pos === "動詞" && t.pos1 === "非自立" && /^(て|で|ちゃ|じゃ|と|ど)/.test(t.surface)) return inflecting;
  if (t.pos === "助詞" && t.pos1 === "接続助詞") return inflecting && /^(て|で|ば|ちゃ|じゃ)$/.test(t.surface);
  if (t.pos === "動詞" && t.pos1 === "接尾") return true;
  if (t.pos === "名詞" && t.pos1 === "接尾") return true;
  if (t.pos === "名詞" && t.pos1 === "非自立" && t.surface === "ん") return inflecting;
  return false;
}

function kanaOf(t: Token, override: string | undefined, script: SubScript): string {
  if (override) return override;
  // Loanwords stay in katakana in a kana line; romaji does not care.
  if (/^[\u3041-\u3096\u30a1-\u30faー]+$/.test(t.surface)) return script === "kana" ? t.surface : kataToHira(t.surface);
  return t.reading || t.surface;
}

/** Romaji for one word's kana: particle は/へ as spoken, names capitalised. */
function romajiOf(kana: string, head: Token, single: boolean): string {
  if (single && head.pos === "助詞") {
    if (head.surface === "は") return "wa";
    if (head.surface === "へ") return "e";
  }
  const r = toRomaji(kana);
  return head.pos1 === "固有名詞" ? r.charAt(0).toUpperCase() + r.slice(1) : r;
}

export function dualPieces(tokens: Token[], script: SubScript, readings: Record<string, string> = {}): DualPiece[] {
  if (script === "kanji") {
    return tokens.map((t, i) => ({ text: t.surface, token: isPunct(t) ? -1 : i, tokens: [i], attached: true }));
  }
  type Group = { head: number; members: number[]; kana: string; suffix: string; before: string; after: string };
  const groups: Group[] = [];
  let opening = "";
  tokens.forEach((t, i) => {
    const last = groups[groups.length - 1];
    if (isPunct(t)) {
      for (const c of t.surface) {
        // Romaji takes Latin punctuation; a kana line keeps its own.
        const mark = (script === "romaji" ? PUNCT[c] ?? c : c).trim();
        if (!mark) continue;
        if (OPENING.has(mark)) opening += mark;
        else if (last) last.after += mark;
        else groups.push({ head: -1, members: [i], kana: "", suffix: "", before: "", after: mark });
      }
      return;
    }
    const kana = kanaOf(t, readings[String(i)], script);
    const open = last && last.head >= 0 && !last.after && !opening;
    if (open && t.pos === "名詞" && t.pos1 === "接尾" && HONORIFICS.has(t.surface)) {
      last.suffix += kana;
      last.members.push(i);
      return;
    }
    if (open && !last.suffix && joins(t, tokens[i - 1])) {
      last.kana += kana;
      last.members.push(i);
      return;
    }
    groups.push({ head: i, members: [i], kana, suffix: "", before: opening, after: "" });
    opening = "";
  });
  if (opening && groups.length) groups[groups.length - 1].after += opening;
  return groups.map((g, n) => {
    if (g.head < 0) return { text: g.after, token: -1, tokens: g.members, attached: true };
    const head = tokens[g.head];
    const word =
      script === "romaji"
        ? romajiOf(g.kana, head, g.members.length === 1) + (g.suffix ? "-" + toRomaji(g.suffix) : "")
        : g.kana + g.suffix;
    return { text: g.before + word + g.after, token: g.head, tokens: g.members, attached: n === 0 };
  });
}

/** The pieces as one string, first letter up for romaji. */
/** Each piece as shown. In romaji every sentence starts with a capital,
 * quoted ones included; the subtitle's word spans and dualText both use this,
 * so what is on screen and what is reported never differ. */
export function displayTexts(pieces: DualPiece[], script: SubScript): string[] {
  if (script !== "romaji") return pieces.map((p) => p.text);
  let sentenceStart = true;
  return pieces.map((p) => {
    const text = sentenceStart ? p.text.replace(/^([^A-Za-z]*)([a-z])/, (_m, a: string, b: string) => a + b.toUpperCase()) : p.text;
    if (/[A-Za-z]/.test(p.text)) sentenceStart = false;
    if (/[.!?…][\u201d")]*$/.test(p.text)) sentenceStart = true;
    return text;
  });
}

export function dualText(pieces: DualPiece[], script: SubScript): string {
  const texts = displayTexts(pieces, script);
  let out = "";
  pieces.forEach((p, i) => { out += (out && !p.attached && script !== "kanji" ? " " : "") + texts[i]; });
  return out.trim();
}
