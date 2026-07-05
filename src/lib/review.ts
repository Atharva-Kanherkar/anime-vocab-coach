// Standalone review selection. The SRS only worked before if a due word
// happened to reappear on screen while watching — so most reviews never fired.
// This surfaces due words directly so a learner can review any time.
import type { VocabMap, VocabRecord } from "../types";

export interface DueWord {
  base: string;
  record: VocabRecord;
}

/**
 * Words whose spaced-repetition review is due now, most-overdue first.
 * A word is due when it's in the "learning" state with an SRS entry whose
 * dueAt has passed. `limit` caps a single session.
 */
export function getDueWords(vocab: VocabMap, now: number = Date.now(), limit = 50): DueWord[] {
  const due: DueWord[] = [];
  for (const base of Object.keys(vocab)) {
    const record = vocab[base];
    if (record.state === "learning" && record.srs && record.srs.dueAt <= now) {
      due.push({ base, record });
    }
  }
  due.sort((a, b) => a.record.srs!.dueAt - b.record.srs!.dueAt);
  return due.slice(0, limit);
}

/** How many reviews are due now (uncapped) — for badges/labels. */
export function dueCount(vocab: VocabMap, now: number = Date.now()): number {
  let n = 0;
  for (const base of Object.keys(vocab)) {
    const r = vocab[base];
    if (r.state === "learning" && r.srs && r.srs.dueAt <= now) n++;
  }
  return n;
}
