// Manga Studio: users turn the words they're learning into their own 4-panel
// manga. The learning mechanic is baked into generation — every target word
// MUST appear in the Japanese dialogue, and the reader renders JA/romaji/EN
// side by side with the target words highlighted, followed by a recall check.
//
// Two OpenAI calls per creation:
//   1. Script: a chat model writes the 4-panel script as strict JSON, weaving
//      the learner's words into simple (JLPT N5–N4) dialogue.
//   2. Art: gpt-image-2 draws ONE manga page (2×2 panel grid) from the visual
//      beats. No text is baked into the art — dialogue renders in the UI, the
//      same pattern as the saga reader's JA/romaji translation boxes.
//
// Free while the launch window is open, capped per user per month (see
// STUDIO_CREATIONS_PER_MONTH in wrangler.jsonc + docs/unit-economics.md).

import { STYLE_FAMILIES, type StyleKey } from "@/lib/cards";

export interface StudioWord {
  /** Dictionary/base form as the learner knows it (kanji or kana). */
  base: string;
  /** Kana reading (optional for custom words). */
  reading: string;
  /** English gloss. */
  gloss: string;
}

export interface StudioText {
  speaker: string;
  ja: string;
  romaji: string;
  en: string;
}

export interface StudioPanelScript {
  /** Purely visual beat for the image model — no text/writing in the scene. */
  art: string;
  texts: StudioText[];
}

export interface StudioCreationMeta {
  id: string;
  ownerId: string;
  title: { en: string; ja: string; romaji: string };
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
  panels: StudioPanelScript[];
  isPublic: boolean;
  createdAt: string;
}

/** Light row stored in the per-user index and returned by the list API. */
export interface StudioIndexEntry {
  id: string;
  title: { en: string; ja: string; romaji: string };
  words: string[];
  styleKey: StyleKey;
  isPublic: boolean;
  createdAt: string;
}

export function toIndexEntry(meta: StudioCreationMeta): StudioIndexEntry {
  return {
    id: meta.id,
    title: meta.title,
    words: meta.words.map((w) => w.base),
    styleKey: meta.styleKey,
    isPublic: meta.isPublic,
    createdAt: meta.createdAt,
  };
}

/** Row in the global public gallery (everyone's published word mangas). */
export interface WordMangaGalleryEntry {
  id: string;
  title: { en: string; ja: string; romaji: string };
  words: string[];
  styleKey: StyleKey;
  createdAt: string;
}

export function toGalleryEntry(meta: StudioCreationMeta): WordMangaGalleryEntry {
  return {
    id: meta.id,
    title: meta.title,
    words: meta.words.map((w) => w.base),
    styleKey: meta.styleKey,
    createdAt: meta.createdAt,
  };
}

// ── Composer options ─────────────────────────────────────────────────────

/** Styles offered in the composer (subset of the card art families). */
export const STUDIO_STYLES: StyleKey[] = ["slayer", "spirit", "neon", "chibi", "shadow", "mecha"];

export function studioStyleLabel(key: StyleKey): string {
  return STYLE_FAMILIES[key]?.label ?? key;
}

/** Cold-start words for accounts with no captured vocabulary yet — common
 * anime words a beginner plausibly wants. Same shape as synced words. */
export const STARTER_WORDS: StudioWord[] = [
  { base: "仲間", reading: "なかま", gloss: "comrade; friend" },
  { base: "夢", reading: "ゆめ", gloss: "dream" },
  { base: "戦う", reading: "たたかう", gloss: "to fight" },
  { base: "心", reading: "こころ", gloss: "heart; mind" },
  { base: "力", reading: "ちから", gloss: "power; strength" },
  { base: "約束", reading: "やくそく", gloss: "promise" },
  { base: "守る", reading: "まもる", gloss: "to protect" },
  { base: "退屈", reading: "たいくつ", gloss: "boredom" },
  { base: "先輩", reading: "せんぱい", gloss: "senior; upperclassman" },
  { base: "無理", reading: "むり", gloss: "impossible; no way" },
  { base: "大丈夫", reading: "だいじょうぶ", gloss: "okay; all right" },
  { base: "覚える", reading: "おぼえる", gloss: "to remember; to learn" },
];

// ── Limits ───────────────────────────────────────────────────────────────

export const MAX_STUDIO_WORDS = 3;
export const MAX_WORD_BASE_LEN = 40;
export const MAX_WORD_GLOSS_LEN = 80;
export const MAX_PREMISE_LEN = 200;
export const STUDIO_PANEL_COUNT = 4;
export const DEFAULT_STUDIO_LIMIT = 5; // creations / user / month
export const DEFAULT_STUDIO_SCRIPT_MODEL = "gpt-4.1-mini";
export const DEFAULT_STUDIO_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_STUDIO_IMAGE_QUALITY = "medium";
/** Portrait manga page. */
export const STUDIO_IMAGE_SIZE = "1024x1536";

// ── Request validation ───────────────────────────────────────────────────

export interface StudioGenerateRequest {
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
}

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeStudioRequest(
  body: unknown
): { req: StudioGenerateRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;

  const styleKey = typeof b.styleKey === "string" && b.styleKey in STYLE_FAMILIES
    ? (b.styleKey as StyleKey)
    : null;
  if (!styleKey) return { error: "invalid_style" };

  const rawWords = Array.isArray(b.words) ? b.words.slice(0, MAX_STUDIO_WORDS) : [];
  const words: StudioWord[] = [];
  for (const raw of rawWords) {
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Record<string, unknown>;
    const base = clamp(w.base, MAX_WORD_BASE_LEN);
    const gloss = clamp(w.gloss, MAX_WORD_GLOSS_LEN);
    const reading = clamp(w.reading, MAX_WORD_BASE_LEN);
    if (base && gloss) words.push({ base, reading, gloss });
  }
  if (words.length === 0) return { error: "no_words" };

  return { req: { words, styleKey, premise: clamp(b.premise, MAX_PREMISE_LEN) } };
}

// ── Script generation ────────────────────────────────────────────────────

export function buildScriptPrompt(req: StudioGenerateRequest): { system: string; user: string } {
  const system =
    "You write 4-panel manga scripts for beginner Japanese learners. Rules:\n" +
    "- Exactly 4 panels telling one tiny, complete, emotionally satisfying scene with TWO recurring characters (give them short names).\n" +
    "- Dialogue is SIMPLE spoken Japanese, JLPT N5-N4 grammar only, each line at most ~12 words.\n" +
    "- Every TARGET WORD must appear naturally in the Japanese dialogue at least once, in its given form or a simple conjugation.\n" +
    "- Each panel has 1-2 dialogue lines. Provide ja (Japanese), romaji (Hepburn), and en (natural English) for every line.\n" +
    "- Each panel's `art` is a purely VISUAL description in English (setting, characters, action, emotion, framing). Never mention text, letters, signs, or speech balloons.\n" +
    '- Respond ONLY as strict JSON: {"title":{"en":string,"ja":string,"romaji":string},"panels":[{"art":string,"texts":[{"speaker":string,"ja":string,"romaji":string,"en":string}]}]} with exactly 4 panels.';

  const wordLines = req.words
    .map((w) => `- ${w.base}${w.reading ? ` (${w.reading})` : ""} — "${w.gloss}"`)
    .join("\n");
  const user =
    `TARGET WORDS:\n${wordLines}\n\n` +
    (req.premise ? `SCENE IDEA FROM THE LEARNER (optional to follow loosely): ${req.premise}\n\n` : "") +
    "Write the 4-panel script now.";

  return { system, user };
}

function clampText(t: Record<string, unknown>): StudioText | null {
  const ja = clamp(t.ja, 160);
  if (!ja) return null;
  return {
    speaker: clamp(t.speaker, 24),
    ja,
    romaji: clamp(t.romaji, 240),
    en: clamp(t.en, 240),
  };
}

/** Shape-check the model's script JSON. Throws on an unusable script. */
export function normalizeScript(parsed: unknown): {
  title: { en: string; ja: string; romaji: string };
  panels: StudioPanelScript[];
} {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const rawTitle = (p.title ?? {}) as Record<string, unknown>;
  const title = {
    en: clamp(rawTitle.en, 80) || "Untitled",
    ja: clamp(rawTitle.ja, 80),
    romaji: clamp(rawTitle.romaji, 120),
  };

  const rawPanels = Array.isArray(p.panels) ? p.panels.slice(0, STUDIO_PANEL_COUNT) : [];
  const panels: StudioPanelScript[] = [];
  for (const raw of rawPanels) {
    if (!raw || typeof raw !== "object") continue;
    const rp = raw as Record<string, unknown>;
    const art = clamp(rp.art, 500);
    const texts = (Array.isArray(rp.texts) ? rp.texts.slice(0, 2) : [])
      .map((t) => (t && typeof t === "object" ? clampText(t as Record<string, unknown>) : null))
      .filter((t): t is StudioText => t !== null);
    if (art && texts.length > 0) panels.push({ art, texts });
  }
  if (panels.length !== STUDIO_PANEL_COUNT) throw new Error("studio_bad_script");

  return { title, panels };
}

// ── Image generation ─────────────────────────────────────────────────────

const PANEL_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function buildPagePrompt(styleKey: StyleKey, panels: StudioPanelScript[]): string {
  const family = STYLE_FAMILIES[styleKey];
  const beats = panels
    .map((p, i) => `Panel ${i + 1} (${PANEL_POSITIONS[i]}): ${p.art}`)
    .join(" ");
  return (
    "A single full-color manga PAGE containing exactly 4 rectangular panels in a 2x2 grid, " +
    "clean white gutters between panels, thin black panel borders. " +
    `${family.style} ` +
    `The same two characters appear consistently across all panels. ${beats} ` +
    "Absolutely no text, no letters, no kanji, no numbers, no speech balloons, no captions, " +
    "no logos, and no watermarks anywhere in the image."
  );
}
