"use client";

// Web-side progression: XP earned in the browser without the extension, so
// people who don't watch on Netflix/Chrome can still level up and unlock saga
// chapters and cards. Source: finishing a saga chapter (once per chapter).
// Stored in localStorage and blended into useUserLevel alongside snapshot XP.
// The weekly leaderboard is untouched — it ranks synced extension stats only.

import { useSyncExternalStore } from "react";

export const STUDIO_PROGRESS_KEY = "animevocab.studioProgress.v1";
export const STUDIO_PROGRESS_EVENT = "animevocab-studio-progress";

export const XP_PER_CHAPTER_READ = 100;

export interface StudioProgress {
  chaptersRead: string[];
}

const EMPTY: StudioProgress = { chaptersRead: [] };

let cachedRaw: string | null = null;
let cachedProgress: StudioProgress = EMPTY;

function load(): StudioProgress {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(STUDIO_PROGRESS_KEY);
  if (!raw) return EMPTY;
  if (raw === cachedRaw) return cachedProgress;
  try {
    const p = JSON.parse(raw) as Partial<StudioProgress>;
    const next: StudioProgress = {
      chaptersRead: Array.isArray(p.chaptersRead) ? p.chaptersRead.filter((c) => typeof c === "string") : [],
    };
    cachedRaw = raw;
    cachedProgress = next;
    return next;
  } catch {
    return EMPTY;
  }
}

function persist(next: StudioProgress): void {
  const raw = JSON.stringify(next);
  cachedRaw = raw;
  cachedProgress = next;
  window.localStorage.setItem(STUDIO_PROGRESS_KEY, raw);
  window.dispatchEvent(new Event(STUDIO_PROGRESS_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STUDIO_PROGRESS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(STUDIO_PROGRESS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(STUDIO_PROGRESS_EVENT, onChange);
  };
}

export function useStudioProgress(): StudioProgress {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

export function studioXp(p: StudioProgress): number {
  return p.chaptersRead.length * XP_PER_CHAPTER_READ;
}

export function markChapterRead(chapterId: string): void {
  const cur = load();
  if (cur.chaptersRead.includes(chapterId)) return;
  persist({ ...cur, chaptersRead: [...cur.chaptersRead, chapterId] });
}

export function hasReadChapter(p: StudioProgress, chapterId: string): boolean {
  return p.chaptersRead.includes(chapterId);
}
