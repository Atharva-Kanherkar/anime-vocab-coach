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

/** One recurring character, kept consistent across every panel's art prompt. */
export interface StudioCastMember {
  name: string;
  look: string;
}

export interface StudioCreationMeta {
  id: string;
  ownerId: string;
  /** Display name shown on the public gallery (never the email). */
  authorName?: string;
  title: { en: string; ja: string; romaji: string };
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
  cast?: StudioCastMember[];
  panels: StudioPanelScript[];
  /**
   * "panels" → each panel has its own image (studio:panel:<id>:<i>); the reader
   * lays them out as a grid. "page" → one baked 2×2 grid image (studio:img:<id>),
   * the legacy single-shot format. Absent is treated as "page".
   */
  layout?: "page" | "panels";
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

/** Row in the global public gallery (everyone's published mangas). */
export interface StudioGalleryEntry {
  id: string;
  title: { en: string; ja: string; romaji: string };
  words: string[];
  styleKey: StyleKey;
  authorName: string;
  /** Which panel image to use as the cover thumbnail (0-based). */
  cover: number;
  /** "panels" per-panel art, "page" legacy grid — tells the card how to load art. */
  layout: "page" | "panels";
  createdAt: string;
}

export function toGalleryEntry(meta: StudioCreationMeta): StudioGalleryEntry {
  return {
    id: meta.id,
    title: meta.title,
    words: meta.words.map((w) => w.base),
    styleKey: meta.styleKey,
    authorName: (meta.authorName || "A learner").trim().slice(0, 40),
    cover: 0,
    layout: meta.layout === "panels" ? "panels" : "page",
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
export const MAX_PREMISE_LEN = 400;
/** Panels the editor drafts. The reader lays them out in a responsive grid. */
export const STUDIO_PANEL_COUNT = 6;
/** Draft may return anywhere in this range; the editor pads/truncates the UI. */
export const MIN_STUDIO_PANELS = 4;
export const MAX_STUDIO_PANELS = 8;
export const DEFAULT_STUDIO_LIMIT = 5; // saved creations / user / month
/** Expensive per-panel art calls. This is the real cost gate, not saved count. */
export const DEFAULT_STUDIO_ART_PER_MONTH = 60; // signed-in art generations / month
export const DEFAULT_STUDIO_ANON_ART_PER_DAY = 8; // ~one manga's worth of taste
export const DEFAULT_STUDIO_ANON_DRAFTS_PER_DAY = 5;
export const DEFAULT_STUDIO_SCRIPT_MODEL = "gpt-4.1-mini";
export const DEFAULT_STUDIO_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_STUDIO_IMAGE_QUALITY = "medium";
/** Single square panel — cheaper than a full page, composed into a grid in the reader. */
export const STUDIO_PANEL_SIZE = "1024x1024";
/** Portrait manga page (legacy single-shot grid format). */
export const STUDIO_IMAGE_SIZE = "1024x1536";
/** Max bytes for an uploaded sketch / stored panel image (~2.7MB decoded). */
export const MAX_PANEL_B64_LEN = 3_600_000;

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
  const n = STUDIO_PANEL_COUNT;
  const system =
    `You write ${n}-panel manga scripts for beginner Japanese learners. Rules:\n` +
    `- Exactly ${n} panels telling one tiny, complete, emotionally satisfying scene with TWO recurring characters (give them short names).\n` +
    "- First define the CAST: the two characters, each with a short vivid VISUAL look (age, hair, outfit, one defining trait) so an artist can draw them consistently across panels. No text/logos in their look.\n" +
    "- Dialogue is SIMPLE spoken Japanese, JLPT N5-N4 grammar only, each line at most ~12 words.\n" +
    "- Every TARGET WORD must appear naturally in the Japanese dialogue at least once, in its given form or a simple conjugation.\n" +
    "- Each panel has 1-2 dialogue lines. Provide ja (Japanese), romaji (Hepburn), and en (natural English) for every line.\n" +
    "- Each panel's `art` is a purely VISUAL description in English (which cast members, setting, action, emotion, framing). Never mention text, letters, signs, or speech balloons.\n" +
    '- Respond ONLY as strict JSON: {"title":{"en":string,"ja":string,"romaji":string},"cast":[{"name":string,"look":string}],"panels":[{"art":string,"texts":[{"speaker":string,"ja":string,"romaji":string,"en":string}]}]}' +
    ` with exactly ${n} panels and exactly 2 cast members.`;

  const wordLines = req.words
    .map((w) => `- ${w.base}${w.reading ? ` (${w.reading})` : ""} — "${w.gloss}"`)
    .join("\n");
  const user =
    `TARGET WORDS:\n${wordLines}\n\n` +
    (req.premise ? `STORY THE LEARNER WANTS (follow its intent, beats, and tone): ${req.premise}\n\n` : "") +
    `Write the ${n}-panel script now.`;

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
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
} {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const rawTitle = (p.title ?? {}) as Record<string, unknown>;
  const title = {
    en: clamp(rawTitle.en, 80) || "Untitled",
    ja: clamp(rawTitle.ja, 80),
    romaji: clamp(rawTitle.romaji, 120),
  };

  const cast: StudioCastMember[] = (Array.isArray(p.cast) ? p.cast.slice(0, 4) : [])
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .map((c) => (c ? { name: clamp(c.name, 24), look: clamp(c.look, 240) } : null))
    .filter((c): c is StudioCastMember => !!c && !!c.look);

  const rawPanels = Array.isArray(p.panels) ? p.panels.slice(0, MAX_STUDIO_PANELS) : [];
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
  if (panels.length < MIN_STUDIO_PANELS) throw new Error("studio_bad_script");

  return { title, cast, panels };
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

const NO_TEXT_CLAUSE =
  "Absolutely no text, no letters, no kanji, no numbers, no speech balloons, no captions, " +
  "no logos, and no watermarks anywhere in the image.";

function castClause(cast: StudioCastMember[] | undefined): string {
  if (!cast || cast.length === 0) return "";
  return (
    "Keep these characters consistent and recognizable: " +
    cast.map((c) => `${c.name || "a character"} (${c.look})`).join("; ") +
    ". "
  );
}

/** One square manga panel from a text beat (text-to-image path). */
export function buildPanelPrompt(
  styleKey: StyleKey,
  art: string,
  cast?: StudioCastMember[]
): string {
  const family = STYLE_FAMILIES[styleKey];
  return (
    "A single full-color manga PANEL, one framed illustration filling the square, thin black border. " +
    `${family.style} ` +
    castClause(cast) +
    `Scene: ${art} ` +
    NO_TEXT_CLAUSE
  );
}

/** Redraw a learner's rough sketch into a polished panel (image-edit path).
 * The sketch defines composition + who-is-where; the model beautifies it into
 * the chosen anime style. This is the "bad drawers become good" pipeline. */
export function buildSketchPrompt(
  styleKey: StyleKey,
  art: string,
  cast?: StudioCastMember[]
): string {
  const family = STYLE_FAMILIES[styleKey];
  return (
    "Redraw this rough sketch into a single polished full-color manga PANEL. " +
    "Faithfully keep the composition, character positions, poses, and layout the sketch shows, " +
    "but render it beautifully. " +
    `${family.style} ` +
    castClause(cast) +
    (art ? `The intended scene: ${art} ` : "") +
    NO_TEXT_CLAUSE
  );
}

// ── Panel-art + finalize request validation ──────────────────────────────

export interface StudioPanelArtRequest {
  styleKey: StyleKey;
  art: string;
  cast: StudioCastMember[];
  /** base64 PNG of the learner's sketch (no data: prefix). Empty ⇒ text-to-image. */
  sketchB64: string;
}

export function normalizePanelArtRequest(
  body: unknown
): { req: StudioPanelArtRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const styleKey =
    typeof b.styleKey === "string" && b.styleKey in STYLE_FAMILIES ? (b.styleKey as StyleKey) : null;
  if (!styleKey) return { error: "invalid_style" };

  const art = clamp(b.art, 500);
  const rawCast = Array.isArray(b.cast) ? b.cast.slice(0, 4) : [];
  const cast: StudioCastMember[] = rawCast
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .map((c) => (c ? { name: clamp(c.name, 24), look: clamp(c.look, 240) } : null))
    .filter((c): c is StudioCastMember => !!c && !!c.look);

  let sketchB64 = "";
  if (typeof b.sketch === "string" && b.sketch) {
    sketchB64 = b.sketch.replace(/^data:image\/\w+;base64,/, "");
    if (sketchB64.length > MAX_PANEL_B64_LEN) return { error: "sketch_too_large" };
    if (!/^[A-Za-z0-9+/=\s]+$/.test(sketchB64)) return { error: "invalid_sketch" };
  }
  if (!art && !sketchB64) return { error: "empty_panel" };

  return { req: { styleKey, art, cast, sketchB64 } };
}

/** The assembled manga the client sends to save (login required). Panel images
 * are uploaded separately (PUT …/panel/<i>) to keep this payload small. */
export interface StudioFinalizeRequest {
  title: { en: string; ja: string; romaji: string };
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
}

export function normalizeFinalizeRequest(
  body: unknown
): { req: StudioFinalizeRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;

  const styleKey =
    typeof b.styleKey === "string" && b.styleKey in STYLE_FAMILIES ? (b.styleKey as StyleKey) : null;
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

  const rawTitle = (b.title ?? {}) as Record<string, unknown>;
  const title = {
    en: clamp(rawTitle.en, 80) || "Untitled",
    ja: clamp(rawTitle.ja, 80),
    romaji: clamp(rawTitle.romaji, 120),
  };

  const rawCast = Array.isArray(b.cast) ? b.cast.slice(0, 4) : [];
  const cast: StudioCastMember[] = rawCast
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .map((c) => (c ? { name: clamp(c.name, 24), look: clamp(c.look, 240) } : null))
    .filter((c): c is StudioCastMember => !!c && !!c.look);

  const rawPanels = Array.isArray(b.panels) ? b.panels.slice(0, MAX_STUDIO_PANELS) : [];
  const panels: StudioPanelScript[] = [];
  for (const raw of rawPanels) {
    if (!raw || typeof raw !== "object") continue;
    const rp = raw as Record<string, unknown>;
    const art = clamp(rp.art, 500);
    const texts = (Array.isArray(rp.texts) ? rp.texts.slice(0, 2) : [])
      .map((t) => (t && typeof t === "object" ? clampText(t as Record<string, unknown>) : null))
      .filter((t): t is StudioText => t !== null);
    if (texts.length > 0) panels.push({ art, texts });
  }
  if (panels.length < MIN_STUDIO_PANELS) return { error: "too_few_panels" };

  return {
    req: { title, words, styleKey, premise: clamp(b.premise, MAX_PREMISE_LEN), cast, panels },
  };
}
