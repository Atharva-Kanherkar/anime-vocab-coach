// The popup's Pro moment (#162): when a learner has just kept a round number
// of words, and who is eligible to be asked.
//
// Words kept is the value moment the extension can see for itself. The
// collectible level that /app celebrates is derived on the server and never
// computed here, and a milestone the learner can read off their own deck is
// easier to trust than a level they cannot.

export const WORD_MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;

/** chrome.storage.local key: the highest milestone this install has shown. */
export const MILESTONE_SEEN_KEY = "proMilestoneSeen";

export interface MilestoneCheck {
  /** Value to store as seen. */
  store: number;
  /** The milestone to celebrate, or null. */
  milestone: number | null;
}

/** Highest milestone at or below `words`, 0 below the first one. */
export function highestMilestone(words: number): number {
  let best = 0;
  for (const m of WORD_MILESTONES) if (words >= m) best = m;
  return best;
}

/**
 * - Nothing stored yet: store the current milestone silently, so a learner
 *   with 300 words is not greeted with "you've kept 250" on update day.
 * - Crossed a higher one: celebrate the highest crossed, once, even if the
 *   deck jumped several milestones between popup opens.
 * - Otherwise nothing, and the stored value never goes down.
 */
export function milestoneReached(seen: number | null, words: number): MilestoneCheck {
  const now = highestMilestone(Math.max(0, Math.floor(words || 0)));
  if (seen === null || !Number.isFinite(seen)) return { store: now, milestone: null };
  if (now > seen) return { store: now, milestone: now };
  return { store: seen, milestone: null };
}

/** Only a signed-in free account with real caps is asked. */
export function proPromptEligible(
  usage: { plan?: string; unlimited?: boolean } | null | undefined
): boolean {
  return !!usage && usage.plan === "free" && !usage.unlimited;
}

/** Words the learner has judged into their collection: learning or known. */
export function keptWordCount(vocab: Record<string, { state?: string } | null | undefined>): number {
  let n = 0;
  for (const rec of Object.values(vocab || {})) {
    if (rec && (rec.state === "learning" || rec.state === "known")) n++;
  }
  return n;
}
