// High-value words/phrases learners should meet early — especially spoken essentials
// that frequency-only scoring can miss (e.g. お願いします is mid-frequency but critical).

export interface EssentialMeta {
  /** Added to the pickTarget score (0..1 scale). */
  boost: number;
  /** Rough JLPT band for UI copy; not used in scoring math yet. */
  jlpt?: "N5" | "N4";
}

/** Keys are dictionary base forms (same as kuromoji token.base). */
export const ESSENTIAL_WORDS: Record<string, EssentialMeta> = {
  ありがとう: { boost: 0.38, jlpt: "N5" },
  どうも: { boost: 0.28, jlpt: "N5" },
  すみません: { boost: 0.36, jlpt: "N5" },
  ごめん: { boost: 0.3, jlpt: "N5" },
  ごめんなさい: { boost: 0.34, jlpt: "N5" },
  お願い: { boost: 0.34, jlpt: "N5" },
  お願いします: { boost: 0.4, jlpt: "N5" },
  ください: { boost: 0.32, jlpt: "N5" },
  おはよう: { boost: 0.3, jlpt: "N5" },
  こんにちは: { boost: 0.3, jlpt: "N5" },
  こんばんは: { boost: 0.28, jlpt: "N5" },
  さようなら: { boost: 0.26, jlpt: "N5" },
  じゃあね: { boost: 0.24, jlpt: "N5" },
  おやすみ: { boost: 0.28, jlpt: "N5" },
  はい: { boost: 0.22, jlpt: "N5" },
  いいえ: { boost: 0.22, jlpt: "N5" },
  大丈夫: { boost: 0.32, jlpt: "N5" },
  分かる: { boost: 0.3, jlpt: "N5" },
  分からない: { boost: 0.3, jlpt: "N5" },
  好き: { boost: 0.28, jlpt: "N5" },
  嫌い: { boost: 0.24, jlpt: "N5" },
  欲しい: { boost: 0.28, jlpt: "N5" },
  行く: { boost: 0.26, jlpt: "N5" },
  来る: { boost: 0.26, jlpt: "N5" },
  見る: { boost: 0.24, jlpt: "N5" },
  聞く: { boost: 0.26, jlpt: "N5" },
  言う: { boost: 0.26, jlpt: "N5" },
  食べる: { boost: 0.28, jlpt: "N5" },
  飲む: { boost: 0.26, jlpt: "N5" },
  勉強: { boost: 0.24, jlpt: "N5" },
  学校: { boost: 0.24, jlpt: "N5" },
  先生: { boost: 0.26, jlpt: "N5" },
  友達: { boost: 0.26, jlpt: "N5" },
  名前: { boost: 0.24, jlpt: "N5" },
  本当: { boost: 0.28, jlpt: "N5" },
  マジ: { boost: 0.22, jlpt: "N5" },
  やばい: { boost: 0.24, jlpt: "N5" },
  頑張る: { boost: 0.28, jlpt: "N5" },
  待つ: { boost: 0.24, jlpt: "N4" },
  思う: { boost: 0.24, jlpt: "N4" },
  知る: { boost: 0.26, jlpt: "N5" },
  会う: { boost: 0.24, jlpt: "N5" },
};

/** Boost essential spoken words while the learner is still on beginner bands (level 5–4). */
export function essentialBoost(base: string, targetLevel: number): number {
  if (targetLevel < 4) return 0;
  return ESSENTIAL_WORDS[base]?.boost ?? 0;
}

export function isEssentialWord(base: string): boolean {
  return base in ESSENTIAL_WORDS;
}

export function learnerBandLabel(targetLevel: number): string {
  switch (targetLevel) {
    case 5: return "Beginner (N5 — everyday essentials first)";
    case 4: return "Elementary (N4 — common daily words)";
    case 3: return "Intermediate (N3 — mid-frequency)";
    case 2: return "Upper intermediate (N2)";
    default: return "Advanced (N1 — rare & literary)";
  }
}
