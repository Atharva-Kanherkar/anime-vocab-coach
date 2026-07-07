// Manga Studio — a creative manga maker. You give a concept (genre, tone,
// setting, a premise), and the AI drafts a whole CHAPTER: a titled sequence of
// panels with a recurring cast and real manga dialogue (speech, thought,
// narration, SFX). You then edit any line, add/reorder/redraw panels, or
// hand-draw a rough sketch the AI redraws into your chosen art style. Publish
// to the free public gallery. No accounts needed to try; sign in (free) to save.
//
// Two OpenAI paths per manga:
//   1. Script: a chat model writes the chapter as strict JSON.
//   2. Art: gpt-image draws ONE image PER PANEL (so each can be redrawn
//      independently). Text is never baked into art — dialogue renders as
//      styled bubbles/boxes in the reader.

import { STYLE_FAMILIES, type StyleKey } from "@/lib/cards";

export type LineKind = "speech" | "thought" | "narration" | "sfx";
export const LINE_KINDS: LineKind[] = ["speech", "thought", "narration", "sfx"];

export interface MangaLine {
  kind: LineKind;
  /** Character name for speech/thought; empty for narration/sfx. */
  speaker: string;
  text: string;
}

/** One recurring character, kept consistent across every panel's art prompt. */
export interface StudioCastMember {
  name: string;
  look: string;
}

export interface StudioPanelScript {
  /** Purely visual beat for the image model — no text/writing in the scene. */
  scene: string;
  lines: MangaLine[];
}

export interface StudioCreationMeta {
  id: string;
  ownerId: string;
  /** Display name shown on the public gallery (never the email). */
  authorName?: string;
  title: { en: string; sub: string };
  logline: string;
  genre: string;
  tone: string;
  setting: string;
  /** Dialogue language, e.g. "English", "日本語". */
  language: string;
  styleKey: StyleKey;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
  /**
   * "panels" → each panel has its own image (studio:panel:<id>:<i>); the reader
   * shows them in sequence. "page" → one legacy baked grid image. Absent ⇒ "page".
   */
  layout?: "page" | "panels";
  isPublic: boolean;
  createdAt: string;
}

/** Light row stored in the per-user index and returned by the list API. */
export interface StudioIndexEntry {
  id: string;
  title: { en: string; sub: string };
  genre: string;
  styleKey: StyleKey;
  isPublic: boolean;
  createdAt: string;
}

export function toIndexEntry(meta: StudioCreationMeta): StudioIndexEntry {
  return {
    id: meta.id,
    title: meta.title,
    genre: meta.genre,
    styleKey: meta.styleKey,
    isPublic: meta.isPublic,
    createdAt: meta.createdAt,
  };
}

/** Row in the global public gallery (everyone's published mangas). */
export interface StudioGalleryEntry {
  id: string;
  title: { en: string; sub: string };
  genre: string;
  tone: string;
  styleKey: StyleKey;
  authorName: string;
  /** Which panel image to use as the cover thumbnail (0-based). */
  cover: number;
  layout: "page" | "panels";
  createdAt: string;
}

export function toGalleryEntry(meta: StudioCreationMeta): StudioGalleryEntry {
  return {
    id: meta.id,
    title: meta.title,
    genre: meta.genre,
    tone: meta.tone,
    styleKey: meta.styleKey,
    authorName: (meta.authorName || "Anonymous").trim().slice(0, 40),
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

export const STUDIO_GENRES = [
  "Shonen action",
  "Shojo romance",
  "Isekai fantasy",
  "Slice of life",
  "Dark fantasy",
  "Sci-fi mecha",
  "Mystery / thriller",
  "Horror",
  "Comedy",
  "Sports",
];

export const STUDIO_TONES = [
  "Epic",
  "Wholesome",
  "Dramatic",
  "Comedic",
  "Dark & moody",
  "Mysterious",
  "Heartfelt",
  "Action-packed",
];

export const STUDIO_LANGUAGES = ["English", "日本語", "Español", "Français", "한국어", "Deutsch", "Português"];

// ── Limits ───────────────────────────────────────────────────────────────

export const MAX_CHARACTERS = 4;
export const MAX_CHAR_NAME_LEN = 40;
export const MAX_CHAR_LOOK_LEN = 240;
export const MAX_PREMISE_LEN = 600;
export const MAX_SETTING_LEN = 200;
export const MAX_GENRE_LEN = 60;
export const MAX_TONE_LEN = 60;
export const MAX_LANG_LEN = 24;
export const MAX_LINES_PER_PANEL = 3;
export const MAX_LINE_LEN = 240;
/** Panels the AI drafts by default; the editor can add/remove within range. */
export const STUDIO_PANEL_COUNT = 6;
export const MIN_STUDIO_PANELS = 3;
export const MAX_STUDIO_PANELS = 12;
export const DEFAULT_STUDIO_LIMIT = 5; // saved creations / user / month
/** Expensive per-panel art calls. This is the real cost gate, not saved count. */
export const DEFAULT_STUDIO_ART_PER_MONTH = 80; // signed-in art generations / month
export const DEFAULT_STUDIO_ANON_ART_PER_DAY = 8; // ~one manga's worth of taste
export const DEFAULT_STUDIO_ANON_DRAFTS_PER_DAY = 6;
export const DEFAULT_STUDIO_SCRIPT_MODEL = "gpt-4.1-mini";
export const DEFAULT_STUDIO_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_STUDIO_IMAGE_QUALITY = "medium";
/** Single square panel — cheaper than a full page, shown in sequence in the reader. */
export const STUDIO_PANEL_SIZE = "1024x1024";
/** Portrait manga page (legacy single-shot grid format). */
export const STUDIO_IMAGE_SIZE = "1024x1536";
/** Max bytes for an uploaded sketch / stored panel image (~2.7MB decoded). */
export const MAX_PANEL_B64_LEN = 3_600_000;

// ── Shared helpers ─────────────────────────────────────────────────────────

function clamp(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeCast(raw: unknown): StudioCastMember[] {
  const arr = Array.isArray(raw) ? raw.slice(0, MAX_CHARACTERS) : [];
  return arr
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .map((c) => (c ? { name: clamp(c.name, MAX_CHAR_NAME_LEN), look: clamp(c.look, MAX_CHAR_LOOK_LEN) } : null))
    .filter((c): c is StudioCastMember => !!c && !!c.look);
}

function normalizeLine(raw: Record<string, unknown>): MangaLine | null {
  const text = clamp(raw.text, MAX_LINE_LEN);
  if (!text) return null;
  const kind = LINE_KINDS.includes(raw.kind as LineKind) ? (raw.kind as LineKind) : "speech";
  const speaker = kind === "narration" || kind === "sfx" ? "" : clamp(raw.speaker, MAX_CHAR_NAME_LEN);
  return { kind, speaker, text };
}

function normalizePanels(raw: unknown, requireLines: boolean): StudioPanelScript[] {
  const arr = Array.isArray(raw) ? raw.slice(0, MAX_STUDIO_PANELS) : [];
  const panels: StudioPanelScript[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const scene = clamp(p.scene, 500);
    const lines = (Array.isArray(p.lines) ? p.lines.slice(0, MAX_LINES_PER_PANEL) : [])
      .map((l) => (l && typeof l === "object" ? normalizeLine(l as Record<string, unknown>) : null))
      .filter((l): l is MangaLine => l !== null);
    if (requireLines ? scene && lines.length > 0 : true) panels.push({ scene, lines });
  }
  return panels;
}

// ── Draft request validation ───────────────────────────────────────────────

export interface StudioGenerateRequest {
  premise: string;
  genre: string;
  tone: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
  characters: StudioCastMember[];
}

export function normalizeStudioRequest(
  body: unknown
): { req: StudioGenerateRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid_body" };
  const b = body as Record<string, unknown>;

  const styleKey =
    typeof b.styleKey === "string" && b.styleKey in STYLE_FAMILIES ? (b.styleKey as StyleKey) : null;
  if (!styleKey) return { error: "invalid_style" };

  const premise = clamp(b.premise, MAX_PREMISE_LEN);
  const genre = clamp(b.genre, MAX_GENRE_LEN);
  if (!premise && !genre) return { error: "empty_concept" };

  return {
    req: {
      premise,
      genre,
      tone: clamp(b.tone, MAX_TONE_LEN),
      setting: clamp(b.setting, MAX_SETTING_LEN),
      language: clamp(b.language, MAX_LANG_LEN) || "English",
      styleKey,
      characters: normalizeCast(b.characters),
    },
  };
}

// ── Script generation ────────────────────────────────────────────────────

export function buildScriptPrompt(req: StudioGenerateRequest): { system: string; user: string } {
  const n = STUDIO_PANEL_COUNT;
  const system =
    "You are a professional manga author and storyboard artist. Given a concept, write ONE chapter " +
    `as a sequence of about ${n} panels that tells a vivid, cinematic, emotionally engaging scene. Rules:\n` +
    `- Return ${MIN_STUDIO_PANELS}-${MAX_STUDIO_PANELS} panels (aim for ${n}). Each panel is one visual moment that moves the story.\n` +
    "- Give the chapter a punchy TITLE (a main title plus a short stylized subtitle) and a one-line LOGLINE.\n" +
    "- Define the CAST: each character with a name and a vivid VISUAL look (age, hair, clothing, defining features) so an artist can draw them consistently. Never put text/logos in a look.\n" +
    "- Each panel has a `scene`: a purely VISUAL description in English for the artist (which characters, setting, action, camera framing, emotion). Never mention text, letters, signs, or speech balloons.\n" +
    "- Each panel has 1-3 `lines`. Each line has a `kind`: \"speech\" (a character talking out loud), \"thought\" (internal monologue), \"narration\" (caption/omniscient voice), or \"sfx\" (a sound effect, e.g. BOOM, ドン). `speaker` is the character's name for speech/thought, empty for narration/sfx. `text` is the actual words the reader sees.\n" +
    "- Write ALL dialogue/narration/sfx text in the requested LANGUAGE. Match the requested GENRE and TONE. Make it immersive.\n" +
    '- Respond ONLY as strict JSON: {"title":{"en":string,"sub":string},"logline":string,"cast":[{"name":string,"look":string}],"panels":[{"scene":string,"lines":[{"kind":string,"speaker":string,"text":string}]}]}';

  const parts: string[] = [];
  if (req.premise) parts.push(`CONCEPT: ${req.premise}`);
  if (req.genre) parts.push(`GENRE: ${req.genre}`);
  if (req.tone) parts.push(`TONE: ${req.tone}`);
  if (req.setting) parts.push(`SETTING: ${req.setting}`);
  parts.push(`DIALOGUE LANGUAGE: ${req.language}`);
  if (req.characters.length > 0) {
    parts.push(
      "CHARACTERS THE AUTHOR WANTS (use these, keep their looks):\n" +
        req.characters.map((c) => `- ${c.name || "(unnamed)"}: ${c.look}`).join("\n")
    );
  }
  parts.push("Write the chapter now.");

  return { system, user: parts.join("\n\n") };
}

/** Shape-check the model's script JSON. Throws on an unusable script. */
export function normalizeScript(parsed: unknown): {
  title: { en: string; sub: string };
  logline: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
} {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const rawTitle = (p.title ?? {}) as Record<string, unknown>;
  const title = {
    en: clamp(rawTitle.en, 80) || "Untitled",
    sub: clamp(rawTitle.sub, 120),
  };
  const cast = normalizeCast(p.cast);
  const panels = normalizePanels(p.panels, true);
  if (panels.length < MIN_STUDIO_PANELS) throw new Error("studio_bad_script");
  return { title, logline: clamp(p.logline, 240), cast, panels };
}

// ── Image generation ─────────────────────────────────────────────────────

const PANEL_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"];

export function buildPagePrompt(styleKey: StyleKey, panels: StudioPanelScript[]): string {
  const family = STYLE_FAMILIES[styleKey];
  const beats = panels
    .slice(0, 4)
    .map((p, i) => `Panel ${i + 1} (${PANEL_POSITIONS[i]}): ${p.scene}`)
    .join(" ");
  return (
    "A single full-color manga PAGE containing exactly 4 rectangular panels in a 2x2 grid, " +
    "clean white gutters between panels, thin black panel borders. " +
    `${family.style} ` +
    `The same characters appear consistently across all panels. ${beats} ` +
    NO_TEXT_CLAUSE
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

/** One square manga panel from a scene beat (text-to-image path). */
export function buildPanelPrompt(styleKey: StyleKey, scene: string, cast?: StudioCastMember[]): string {
  const family = STYLE_FAMILIES[styleKey];
  return (
    "A single full-color manga PANEL, one framed illustration filling the square, thin black border. " +
    `${family.style} ` +
    castClause(cast) +
    `Scene: ${scene} ` +
    NO_TEXT_CLAUSE
  );
}

/** Redraw a creator's rough sketch into a polished panel (image-edit path).
 * The sketch defines composition + who-is-where; the model beautifies it into
 * the chosen anime style. This is the "bad drawers become good" pipeline. */
export function buildSketchPrompt(styleKey: StyleKey, scene: string, cast?: StudioCastMember[]): string {
  const family = STYLE_FAMILIES[styleKey];
  return (
    "Redraw this rough sketch into a single polished full-color manga PANEL. " +
    "Faithfully keep the composition, character positions, poses, and layout the sketch shows, " +
    "but render it beautifully. " +
    `${family.style} ` +
    castClause(cast) +
    (scene ? `The intended scene: ${scene} ` : "") +
    NO_TEXT_CLAUSE
  );
}

// ── Panel-art request validation ───────────────────────────────────────────

export interface StudioPanelArtRequest {
  styleKey: StyleKey;
  scene: string;
  cast: StudioCastMember[];
  /** base64 PNG of the creator's sketch (no data: prefix). Empty ⇒ text-to-image. */
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

  const scene = clamp(b.scene, 500);
  const cast = normalizeCast(b.cast);

  let sketchB64 = "";
  if (typeof b.sketch === "string" && b.sketch) {
    sketchB64 = b.sketch.replace(/^data:image\/\w+;base64,/, "");
    if (sketchB64.length > MAX_PANEL_B64_LEN) return { error: "sketch_too_large" };
    if (!/^[A-Za-z0-9+/=\s]+$/.test(sketchB64)) return { error: "invalid_sketch" };
  }
  if (!scene && !sketchB64) return { error: "empty_panel" };

  return { req: { styleKey, scene, cast, sketchB64 } };
}

// ── Finalize (save) request validation ─────────────────────────────────────

export interface StudioFinalizeRequest {
  title: { en: string; sub: string };
  logline: string;
  genre: string;
  tone: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
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

  const rawTitle = (b.title ?? {}) as Record<string, unknown>;
  const title = { en: clamp(rawTitle.en, 80) || "Untitled", sub: clamp(rawTitle.sub, 120) };

  const panels = normalizePanels(b.panels, false).filter((p) => p.scene || p.lines.length > 0);
  if (panels.length < MIN_STUDIO_PANELS) return { error: "too_few_panels" };

  return {
    req: {
      title,
      logline: clamp(b.logline, 240),
      genre: clamp(b.genre, MAX_GENRE_LEN),
      tone: clamp(b.tone, MAX_TONE_LEN),
      setting: clamp(b.setting, MAX_SETTING_LEN),
      language: clamp(b.language, MAX_LANG_LEN) || "English",
      styleKey,
      cast: normalizeCast(b.cast),
      panels,
    },
  };
}
