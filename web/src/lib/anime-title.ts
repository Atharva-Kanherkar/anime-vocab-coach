// Reduce a player's window title to the SERIES it belongs to.
//
// WHY THIS EXISTS. The anime-context cache is keyed on a hash of the title the
// extension reports, and that title comes from `document.title` with only the
// site suffix removed — so it carries the episode number. "Naruto Shippuden
// Episode 42 – The Promise" and "…Episode 43…" hashed to two different keys for
// the same show, and every episode paid for a fresh completion.
//
// On 2026-09-20 that showed up as a 6.8% cache hit rate: 3 hits against 41 paid
// lookups, 87% of all AI spend, and a 3.2s wait in front of the learner on
// nearly every card. Show context does not change between episodes; the cache
// key should not either.
//
// The rule is deliberately conservative. Over-stripping is worse than
// under-stripping: a number in a title is usually part of the name (Gundam 00,
// Steins;Gate 0, 86, Fruits Basket (2019)), so nothing is cut unless an actual
// episode marker says so. Missing a strip costs one extra cached entry. A wrong
// strip merges two different shows and serves a learner notes about the wrong
// one.

/** Bound the key's input, same limit the cache has always used. */
export const MAX_ANIME_TITLE_LEN = 120;

/**
 * Episode markers, in the forms real players actually emit.
 *
 * Each one cuts the title at its own start, so whatever precedes it survives.
 * `\d` is required in every pattern — that is what keeps "Epic Seven" and
 * "Season of the Witch" intact.
 */
const EPISODE_MARKERS: RegExp[] = [
  // "… - Episode 5 - To You, 2000 Years From Now" (Crunchyroll), "Ep. 12", "EP12"
  /\s*[-–—|:]?\s*\bep(?:isode|\.)?\s*\d+\b.*$/i,
  // "S2E5", "S02 E05"
  /\s*[-–—|:]?\s*\bs\d{1,2}\s*[ex]\s*\d{1,3}\b.*$/i,
  // 第12話 / 第12回 / 第12夜 — the Japanese episode counter
  /\s*[-–—|:]?\s*第\s*\d+\s*[話回夜羽].*$/,
  // "SERIES #12" — the space matters, so "AKIRA#1" style IDs are left alone
  /\s+#\s*\d+\b.*$/,
];

/**
 * A trailing season marker, removed AFTER the episode cut so that
 * "Series Season 2 Episode 5" and "Series S2E5" land on the same key.
 * Only ever stripped from the end, and only when a number follows.
 */
const TRAILING_SEASON = /\s*[-–—|:(]?\s*\b(?:season|s(?:eason)?)\s*\d{1,2}\b\)?\s*$/i;

/**
 * Release/format tags, stripped only from the end and only from this closed
 * list. A general "drop trailing parentheses" rule would eat "Fruits Basket
 * (2019)", where the year is how you tell two different adaptations apart.
 */
const TRAILING_TAG =
  /\s*[([【]\s*(?:dub|sub|subbed|dubbed|subtitled|english(?:\s+(?:dub|sub))?|japanese(?:\s+(?:dub|audio))?|uncut|uncensored|censored|hd|fhd|sd|4k|\d{3,4}p|公式|official)\s*[)\]】]\s*$/i;

/** Leading group tags: 【公式】, [HorribleSubs], (Official). */
const LEADING_TAG = /^\s*(?:[([【][^)\]】]{0,40}[)\]】]\s*)+/;

/** Separators and connectors left dangling once a marker is cut away. */
const TRAILING_JUNK = /[\s\-–—|:~・,.]+$/;

/**
 * The series a title belongs to.
 *
 * Returns the input (trimmed and bounded) when stripping would leave nothing —
 * a title that is only "Episode 5" carries no series, and an empty cache key
 * would collapse every such lookup onto one shared, meaningless entry.
 */
export function seriesTitle(raw: string): string {
  const full = (raw || "").replace(/\s+/g, " ").trim().slice(0, MAX_ANIME_TITLE_LEN);
  if (!full) return "";

  let out = full.replace(LEADING_TAG, "").trim() || full;

  // Cut at the EARLIEST marker present, not the first pattern that matches:
  // "S2E5 - Episode 5" should lose both, and which regex wins is otherwise
  // an accident of the list's order.
  let cut = out.length;
  for (const marker of EPISODE_MARKERS) {
    const m = marker.exec(out);
    if (m && m.index < cut) cut = m.index;
  }
  out = out.slice(0, cut);

  out = out.replace(TRAILING_SEASON, "");
  // Tags can nest — "(Dub) [1080p]" — so peel until nothing more comes off.
  for (let i = 0; i < 3; i++) {
    const next = out.replace(TRAILING_TAG, "");
    if (next === out) break;
    out = next;
  }
  out = out.replace(TRAILING_JUNK, "").trim();

  return out || full;
}

/** The exact string the cache key is hashed from. */
export function animeContextCacheBasis(raw: string): string {
  return seriesTitle(raw).toLowerCase();
}
