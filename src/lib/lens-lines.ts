// Listening Mode lines, cut to subtitle size for the Lens.
//
// A realtime transcript arrives once the speaker stops, as one utterance. The
// Lens used to put the whole utterance up at once, so a long speech became a
// wall of text that no subtitle would ever be. It now shows the utterance a
// piece at a time, each piece about as long as a subtitle line.

const SENTENCE = { ja: /(?<=[。！？!?…])/, en: /(?<=[.!?…])\s+/ } as const;
/** Characters a too-long piece may break after. */
const SOFT_BREAK = { ja: /[、,，」』）)\s]/, en: /\s/ } as const;
export const LENS_MAX_CHARS = { ja: 28, en: 90 } as const;

/** Cut `text` into pieces no longer than `maxChars`, at sentence ends first,
 * then at the last comma or space before the cap, then hard at the cap. */
export function splitForLens(text: string, lang: "ja" | "en", maxChars: number = LENS_MAX_CHARS[lang]): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  for (const sentence of clean.split(SENTENCE[lang])) {
    let rest = sentence.trim();
    while (rest.length > maxChars) {
      let cut = maxChars;
      // No further back than a third of the cap: a tiny first piece is worse
      // than a hard break.
      for (let i = maxChars - 1; i >= Math.floor(maxChars / 3); i--) {
        if (SOFT_BREAK[lang].test(rest[i])) {
          cut = i + 1;
          break;
        }
      }
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out.filter(Boolean);
}

/** How long a piece stays up before the next replaces it: about reading
 * speed, never a flash and never a stall. */
export function lensPieceDelayMs(piece: string, lang: "ja" | "en"): number {
  const perChar = lang === "ja" ? 90 : 45;
  return Math.min(4000, Math.max(1200, piece.length * perChar));
}
