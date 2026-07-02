AVC.scoring = {
  ELIGIBLE_POS: ["名詞", "動詞", "形容詞", "副詞"],
  EXCLUDED_NOUN_POS1: ["代名詞", "数", "接尾", "非自立", "固有名詞"],

  hasKanji(base) {
    return /[一-鿿]/.test(base);
  },

  checkEligibility(token, wordStates, targetedSet) {
    const { base, pos, pos1 } = token;

    if (!this.ELIGIBLE_POS.includes(pos)) {
      return { eligible: false, countSeen: false };
    }
    if (pos === "名詞" && this.EXCLUDED_NOUN_POS1.includes(pos1)) {
      return { eligible: false, countSeen: false };
    }
    if (base.length < 2 && !this.hasKanji(base)) {
      return { eligible: false, countSeen: false };
    }

    const entry = AVC.dict.lookup(base);
    if (!entry) {
      return { eligible: false, countSeen: false };
    }

    const state = wordStates[base]?.state;
    if (state === "known" || state === "ignored") {
      return { eligible: false, countSeen: true, entry };
    }
    if (targetedSet && targetedSet.has(base)) {
      return { eligible: false, countSeen: true, entry };
    }

    return { eligible: true, countSeen: true, entry };
  },

  pickTarget(tokens, wordStates, settings, targetedSet) {
    const survivors = [];

    for (const token of tokens) {
      const check = this.checkEligibility(token, wordStates, targetedSet);
      if (check.eligible) {
        survivors.push({ token, entry: check.entry });
      }
    }

    const now = Date.now();
    const dueReviews = survivors.filter(({ token }) => {
      const rec = wordStates[token.base];
      return rec?.state === "learning" && rec.srs && rec.srs.dueAt <= now;
    });

    if (dueReviews.length) {
      dueReviews.sort((a, b) => {
        const aDue = wordStates[a.token.base].srs.dueAt;
        const bDue = wordStates[b.token.base].srs.dueAt;
        return aDue - bDue;
      });
      const pick = dueReviews[0];
      return { token: pick.token, entry: pick.entry, isReview: true };
    }

    let best = null;
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
};
