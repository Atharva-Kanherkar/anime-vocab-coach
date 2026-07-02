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
        data = {};
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
