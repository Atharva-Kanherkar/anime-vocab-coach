import type { CloudSyncSnapshot } from "./sync";

// Anki (and most SRS apps) import CSV. Escape per RFC 4180: wrap every cell in
// quotes and double any internal quotes; flatten CR/LF so one note = one row.
function csvCell(value: string): string {
  const s = (value ?? "").replace(/\r\n?|\n/g, " ").trim();
  return `"${s.replace(/"/g, '""')}"`;
}

export const ANKI_COLUMNS = ["word", "reading", "meaning", "sentence", "source", "status"] as const;

// Only words the learner has actually engaged with make useful cards.
function isCardable(state: string): boolean {
  return state === "learning" || state === "known";
}

export function ankiCardCount(snapshot: CloudSyncSnapshot): number {
  return snapshot.words.filter((w) => isCardable(w.state)).length;
}

/**
 * Build an Anki-importable CSV: one note per learnable word, with the
 * mining-card fields (word / reading / meaning / sentence / source / status).
 * Leads with Anki `#` directives, which modern Anki auto-skips AND uses to map
 * columns to fields — a plain header row would instead import as a junk note.
 */
export function toAnkiCsv(snapshot: CloudSyncSnapshot): string {
  const rows = [
    "#separator:Comma",
    "#html:false",
    `#columns:${ANKI_COLUMNS.join(",")}`,
  ];
  for (const w of snapshot.words) {
    if (!isCardable(w.state)) continue;
    const source = [w.source?.title, w.source?.en].filter(Boolean).join(" — ");
    rows.push(
      [
        csvCell(w.base),
        csvCell(w.reading),
        csvCell(w.gloss),
        csvCell(w.source?.line || ""),
        csvCell(source),
        csvCell(w.state),
      ].join(",")
    );
  }
  return rows.join("\n") + "\n";
}
