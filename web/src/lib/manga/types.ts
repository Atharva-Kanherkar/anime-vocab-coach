// Manga saga data model — "The Lantern of Words" (言葉の灯).
// Panels are DRAWN with empty speech balloons; dialogue is overlaid as real
// text so it can toggle JA / romaji / EN (the learning feature) and never
// depends on the image model rendering Japanese. See docs/manga/IMAGE_PIPELINE.md.

export type PanelAspect = "portrait" | "landscape" | "square" | "spread";
export type TextKind = "speech" | "thought" | "caption" | "sfx";

export interface PanelText {
  kind: TextKind;
  /** Anchor of the bubble/caption as % of panel width/height (0–100). */
  x: number;
  y: number;
  /** Speaker name (omitted for captions/sfx). */
  speaker?: string;
  ja: string;
  romaji: string;
  en: string;
}

export interface MangaPanel {
  /** Stable id, e.g. "ch1_p3". Also the art key in manga-art.ts. */
  id: string;
  aspect: PanelAspect;
  /** One-line visual beat — shown as alt text / caption fallback. */
  beat: string;
  /** Card ids whose art seeds this panel via the edits endpoint (consistency). */
  cast: string[];
  /** Prompt fed to gpt-image-2 by scripts/generate-manga.mjs. */
  artPrompt: string;
  texts: PanelText[];
}

export interface MangaChapter {
  n: number;
  /** Stable id, e.g. "ch1". */
  id: string;
  titleEn: string;
  titleJa: string;
  titleRomaji: string;
  /** Chapter unlocks when the player reaches this level. */
  gateLevel: number;
  /** Real-world setting, shown in the header. */
  setting: string;
  /** Cards that debut in this chapter (their level falls in this band). */
  debutCardIds: string[];
  /** Kanji spotlighted this chapter. */
  kanji: string[];
  panels: MangaPanel[];
}
