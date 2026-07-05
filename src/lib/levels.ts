// The dictionary's `level` (5..1) is a FREQUENCY band derived from corpus
// frequency (see levelFromFreq in scripts/build-dictionary.mjs) — NOT a JLPT
// level. It was previously mislabeled "N5..N1", which misleads Japanese
// learners. Label it honestly as commonness. Real JLPT levels (from the
// scripts/jlpt overlay) are a planned follow-up.
export function commonnessLabel(level: number): string {
  switch (level) {
    case 5: return "Very common";
    case 4: return "Common";
    case 3: return "Mid-frequency";
    case 2: return "Uncommon";
    default: return "Rare";
  }
}

// Compact form for tight UI (chart axes, table cells).
export function commonnessShort(level: number): string {
  switch (level) {
    case 5: return "Top";
    case 4: return "Common";
    case 3: return "Mid";
    case 2: return "Uncommon";
    default: return "Rare";
  }
}
