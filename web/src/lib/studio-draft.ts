"use client";

// Client-side working copy of a manga while it's being edited, plus persistence
// so an anonymous learner's in-progress manga survives the trip through login.
// Images are data URLs; we try to persist them but fall back to text-only if
// the browser's localStorage quota can't hold the PNGs (the story + edits are
// what matter most across the login hop — art can be redrawn).

import type {
  StudioCastMember,
  StudioPanelScript,
  StudioText,
  StudioWord,
} from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";

export interface DraftPanel extends StudioPanelScript {
  /** Generated/beautified panel art as a data URL, or null if not drawn yet. */
  image: string | null;
}

export interface StudioDraft {
  title: { en: string; ja: string; romaji: string };
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
  cast: StudioCastMember[];
  panels: DraftPanel[];
}

export const DRAFT_KEY = "animevocab.studioDraft.v1";

export function newDraftFromScript(args: {
  words: StudioWord[];
  styleKey: StyleKey;
  premise: string;
  title: { en: string; ja: string; romaji: string };
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
}): StudioDraft {
  return {
    title: args.title,
    words: args.words,
    styleKey: args.styleKey,
    premise: args.premise,
    cast: args.cast,
    panels: args.panels.map((p) => ({ art: p.art, texts: p.texts, image: null })),
  };
}

export function loadDraft(): StudioDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StudioDraft;
    if (!d || !Array.isArray(d.panels) || d.panels.length === 0) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(draft: StudioDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota exceeded (big PNGs) — keep the story + edits, drop the art.
    try {
      const lite: StudioDraft = {
        ...draft,
        panels: draft.panels.map((p) => ({ ...p, image: null })),
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(lite));
    } catch {
      // Give up silently; the in-memory draft still works this session.
    }
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

/** Panels that still need art before the manga can be published. */
export function panelsMissingArt(draft: StudioDraft): number {
  return draft.panels.filter((p) => !p.image).length;
}

export function updateLine(
  texts: StudioText[],
  j: number,
  patch: Partial<StudioText>
): StudioText[] {
  return texts.map((t, k) => (k === j ? { ...t, ...patch } : t));
}
