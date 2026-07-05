import { lookup } from "./dictionary";
import type { DictEntry, Settings, Target, Token, VocabMap } from "../types";

const ELIGIBLE_POS = ["名詞", "動詞", "形容詞", "副詞"];
const EXCLUDED_NOUN_POS1 = ["代名詞", "数", "接尾", "非自立", "固有名詞"];

export function hasKanji(base: string): boolean {
  return /[一-鿿]/.test(base);
}

export interface Eligibility {
  eligible: boolean;
  countSeen: boolean;
  entry?: DictEntry;
}

export function checkEligibility(
  token: Token,
  wordStates: VocabMap,
  targetedSet: Set<string> | null,
  now: number = Date.now()
): Eligibility {
  const { base, pos, pos1 } = token;

  if (!ELIGIBLE_POS.includes(pos)) {
    return { eligible: false, countSeen: false };
  }
  if (pos === "名詞" && EXCLUDED_NOUN_POS1.includes(pos1)) {
    return { eligible: false, countSeen: false };
  }
  if (base.length < 2 && !hasKanji(base)) {
    return { eligible: false, countSeen: false };
  }

  const entry = lookup(base);
  if (!entry) {
    return { eligible: false, countSeen: false };
  }

  const rec = wordStates[base];
  const state = rec?.state;
  if (state === "known" || state === "ignored") {
    return { eligible: false, countSeen: true, entry };
  }
  // A word being learned is only eligible when its review is actually due.
  // Otherwise it must NOT fall through to the new-word path — showing it as a
  // fresh "learn" card would reset its SRS progress. It's still counted as seen.
  if (state === "learning") {
    const due = !!rec?.srs && rec.srs.dueAt <= now;
    if (!due) return { eligible: false, countSeen: true, entry };
  }
  if (targetedSet && targetedSet.has(base)) {
    return { eligible: false, countSeen: true, entry };
  }

  return { eligible: true, countSeen: true, entry };
}

export function pickTarget(
  tokens: Token[],
  wordStates: VocabMap,
  settings: Settings,
  targetedSet: Set<string>
): Target | null {
  const survivors: { token: Token; entry: DictEntry }[] = [];
  const now = Date.now();

  for (const token of tokens) {
    const check = checkEligibility(token, wordStates, targetedSet, now);
    if (check.eligible && check.entry) {
      survivors.push({ token, entry: check.entry });
    }
  }

  const dueReviews = survivors.filter(({ token }) => {
    const rec = wordStates[token.base];
    return rec?.state === "learning" && rec.srs && rec.srs.dueAt <= now;
  });

  if (dueReviews.length) {
    dueReviews.sort((a, b) => {
      const aDue = wordStates[a.token.base].srs!.dueAt;
      const bDue = wordStates[b.token.base].srs!.dueAt;
      return aDue - bDue;
    });
    const pick = dueReviews[0];
    return { token: pick.token, entry: pick.entry, isReview: true };
  }

  let best: Target | null = null;
  let bestScore = -1;

  for (const { token, entry } of survivors) {
    const freqScore = 1 - Math.min(entry.freqRank, 20000) / 20000;
    const levelScore = 1 - Math.abs(entry.level - settings.targetLevel) / 4;
    const familiarity = Math.min(wordStates[token.base]?.seenCount || 0, 5) / 5;
    const score = 0.45 * freqScore + 0.35 * levelScore + 0.2 * familiarity;

    if (score < 0.35) continue;

    if (!best || score > bestScore || (score === bestScore && entry.freqRank < best.entry.freqRank)) {
      bestScore = score;
      best = { token, entry, isReview: false };
    }
  }

  return best;
}
