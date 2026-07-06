import { CHAPTERS, chapterById, debutPanelForCard, SAGA_TITLE, SAGA_INTRO } from "./chapters";
import type { MangaChapter, MangaPanel, PanelText } from "./types";

export type { MangaChapter, MangaPanel, PanelText };
export type StoryLang = "en" | "ja" | "romaji";
export { CHAPTERS, chapterById, debutPanelForCard, SAGA_TITLE, SAGA_INTRO };

export const STORY_LANGS: { id: StoryLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "romaji", label: "Romaji" },
];

export function pickText(t: PanelText, lang: StoryLang): string {
  return t[lang];
}

/** Chapters up to (and including) the ones the player has unlocked. */
export function chaptersState(userLevel: number, owner = false) {
  return CHAPTERS.map((c) => ({
    chapter: c,
    unlocked: owner || userLevel >= c.gateLevel,
  }));
}

export function panelById(panelId: string): { chapter: MangaChapter; panel: MangaPanel } | null {
  for (const chapter of CHAPTERS) {
    const panel = chapter.panels.find((p) => p.id === panelId);
    if (panel) return { chapter, panel };
  }
  return null;
}
