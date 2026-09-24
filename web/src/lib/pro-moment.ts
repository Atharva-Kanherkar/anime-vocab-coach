// The /app card-unlock moment (#162): when to show it, and for which card.
//
// Kept out of pro-funnel.ts so the /api/track route, which imports the funnel
// allowlists, does not also bundle the whole card catalogue.

import { CARDS, type CardDef } from "./cards";

/** localStorage key: the highest collectible level this browser has seen. */
export const SEEN_LEVEL_KEY = "avc_pro_seen_level";

export interface UnlockCheck {
  /** Level to store as seen. */
  store: number;
  /** The card to celebrate, or null for no moment. */
  card: CardDef | null;
}

/**
 * Compare the learner's level with the one this browser last saw.
 *
 * - Nothing seen yet: store it silently. The first level we observe is an
 *   import of past progress, not an unlock happening now. The sync route
 *   applies the same rule to `card_unlocked`.
 * - Higher: celebrate the newest card in (seen, level]. One banner even when a
 *   long session crossed several levels.
 * - Same or lower: nothing, and the stored level never goes down, so a
 *   snapshot that regresses and re-advances does not celebrate twice.
 */
export function newlyUnlocked(seen: number | null, level: number): UnlockCheck {
  if (seen === null || !Number.isFinite(seen)) return { store: level, card: null };
  if (level <= seen) return { store: seen, card: null };
  let card: CardDef | null = null;
  for (const c of CARDS) {
    if (c.level > seen && c.level <= level && (!card || c.level > card.level)) card = c;
  }
  return { store: level, card };
}

/** Parse the stored level; anything unusable reads as never seen. */
export function parseSeenLevel(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
