// A word's `level` (5..1) is a corpus FREQUENCY band, not a JLPT level. Label
// it honestly. (Web mirror of the extension's src/lib/levels.ts. Real JLPT
// levels are a planned overlay — see issue #37.)
export function commonnessShort(level: number | null | undefined): string {
  switch (level) {
    case 5: return "Very common";
    case 4: return "Common";
    case 3: return "Mid-frequency";
    case 2: return "Uncommon";
    case 1: return "Rare";
    default: return "";
  }
}
