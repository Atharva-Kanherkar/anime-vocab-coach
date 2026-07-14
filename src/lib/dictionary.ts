import { warn } from "./log";
import type { DictEntry } from "../types";

interface RawEntry {
  r: string;
  g: string[];
  l: number;
  f: number;
}

let loadPromise: Promise<Record<string, RawEntry>> | null = null;
let data: Record<string, RawEntry> | null = null;

export function load(): Promise<Record<string, RawEntry>> {
  if (!loadPromise) {
    loadPromise = fetch(chrome.runtime.getURL("data/dictionary.json"))
      .then((r) => r.json())
      .then((d: Record<string, RawEntry>) => {
        data = d;
        return d;
      })
      .catch((err) => {
        warn("dictionary load failed:", err);
        // Don't memoize the failure: a transient fetch error used to leave the
        // dictionary permanently empty for the tab (no card ever shows again).
        // Clearing loadPromise lets the next load() retry.
        loadPromise = null;
        return {};
      });
  }
  return loadPromise;
}

export function lookup(base: string): DictEntry | null {
  if (!data) return null;
  const entry = data[base];
  if (!entry) return null;
  return {
    reading: entry.r,
    glosses: entry.g,
    level: entry.l,
    freqRank: entry.f
  };
}
