"use client";

// Client-side working copy of a manga while it's being edited, plus persistence
// so an anonymous creator's in-progress chapter survives the trip through login.
// Images are data URLs; we try to persist them but fall back to text-only if the
// browser's localStorage quota can't hold the PNGs (the script + edits matter
// most across the login hop — art can be redrawn).

import type { MangaLine, StudioCastMember, StudioPanelScript } from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";

export interface DraftPanel extends StudioPanelScript {
  /** Generated/beautified panel art as a data URL, or null if not drawn yet. */
  image: string | null;
}

export interface StudioDraft {
  title: { en: string; sub: string };
  logline: string;
  genre: string;
  tone: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
  cast: StudioCastMember[];
  panels: DraftPanel[];
}

export const DRAFT_KEY = "animevocab.studioDraft.v2";

export function newDraftFromScript(args: {
  genre: string;
  tone: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
  title: { en: string; sub: string };
  logline: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
}): StudioDraft {
  return {
    title: args.title,
    logline: args.logline,
    genre: args.genre,
    tone: args.tone,
    setting: args.setting,
    language: args.language,
    styleKey: args.styleKey,
    cast: args.cast,
    panels: args.panels.map((p) => ({ scene: p.scene, lines: p.lines, image: null })),
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
    // Quota exceeded (big PNGs) — keep the script + edits, drop the art.
    try {
      const lite: StudioDraft = { ...draft, panels: draft.panels.map((p) => ({ ...p, image: null })) };
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

export function updateLine(lines: MangaLine[], j: number, patch: Partial<MangaLine>): MangaLine[] {
  return lines.map((l, k) => (k === j ? { ...l, ...patch } : l));
}
