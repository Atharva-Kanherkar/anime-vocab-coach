import {
  newLearnOp,
  emptyLearnState,
  applyLearnDelta,
  projectLearnOp,
  type LearnOp,
  type LearnState,
  type LearnChange,
} from "../../web/src/lib/learn-protocol/model";
import { publicSettings } from "../../web/src/lib/learn-protocol/validate";
import {
  normalizeAnimeVocabExport,
  cloudSnapshotToAnimeVocabExport,
  type AnimeVocabExport,
} from "../../web/src/lib/sync";
export interface PendingLearnOp {
  token: string;
  ownerId: string | null;
  op: LearnOp;
}
export const LEARN_KEYS = [
  "learnOutbox",
  "learnOwner",
  "learnOwnerToken",
  "learnCursor",
  "learnRemote",
  "learnInitialized",
  "learnLegacy",
  "learnEpoch",
  "syncToken",
  "vocab",
  "stats",
  "settings",
];
export function localImportOps(raw: AnimeVocabExport): LearnOp[] {
  const snapshot = normalizeAnimeVocabExport(raw);
  return [
    ...snapshot.words.map((word) => newLearnOp("import_local", { word })),
    ...snapshot.daily.map((daily) => newLearnOp("import_local", { daily })),
    newLearnOp("import_local", { settings: publicSettings(snapshot.settings) }),
  ];
}
/** Called only in storage.ts's worker queue, alongside the cache write. */
export async function learningPatch(
  before: AnimeVocabExport,
  patch: Partial<AnimeVocabExport>,
  intent = "seen",
  review?: { base: string; result: "pass" | "fail"; day: string },
): Promise<Record<string, unknown>> {
  const stored = await chrome.storage.local.get(LEARN_KEYS);
  const next = normalizeAnimeVocabExport({ ...before, ...patch });
  const previous = normalizeAnimeVocabExport(before);
  const ops: LearnOp[] = [];
  if (patch.settings) {
    const changed = Object.fromEntries(
      Object.entries(publicSettings(patch.settings)).filter(
        ([k, v]) => JSON.stringify(v) !== JSON.stringify(previous.settings[k]),
      ),
    );
    if (Object.keys(changed).length)
      ops.push(newLearnOp("settings", { settings: changed }));
  }
  if (patch.vocab) {
    const prior = new Map(previous.words.map((w) => [w.base, w]));
    for (const word of next.words) {
      const old = prior.get(word.base);
      if (JSON.stringify(word) === JSON.stringify(old)) continue;
      if (review?.base === word.base && old) continue;
      ops.push(
        newLearnOp("word", {
          word,
          intent,
          seenDelta: Math.max(0, word.seenCount - (old?.seenCount || 0)),
          shownDelta: Math.max(0, word.shownCount - (old?.shownCount || 0)),
        }),
      );
    }
  }
  if (review) ops.push(newLearnOp("review", review));
  if (patch.stats) {
    const prior = new Map(previous.daily.map((d) => [d.day, d]));
    for (const row of next.daily) {
      const old = prior.get(row.day);
      const delta: Record<string, number> = {};
      for (const key of ["met", "judged", "reviews", "watchMin"] as const) {
        const n =
          row[key] -
          (old?.[key] || 0) -
          (review &&
          review.day === row.day &&
          (key === "judged" || key === "reviews")
            ? 1
            : 0);
        if (n > 0) delta[key] = n;
      }
      if (Object.keys(delta).length)
        ops.push(newLearnOp("progress", { day: row.day, delta }));
    }
  }
  const pending = (stored.learnOutbox || []) as PendingLearnOp[];
  const token = String(stored.learnOwnerToken || stored.syncToken || "");
  const ownerId =
    typeof stored.learnOwner === "string" ? stored.learnOwner : null;
  const result: Record<string, unknown> = {
    ...patch,
    learnOutbox: [...pending, ...ops.map((op) => ({ token, ownerId, op }))],
  };
  // Freeze the pre-op legacy deck so a first-link import cannot apply pending
  // reviews a second time after importing their already-reviewed cache.
  if (!stored.learnInitialized && !stored.learnLegacy)
    result.learnLegacy = structuredClone({
      vocab: before.vocab ?? stored.vocab,
      stats: before.stats ?? stored.stats,
      settings: before.settings ?? stored.settings,
    });
  return result;
}
export function cacheFromState(
  remote: LearnState,
  pending: PendingLearnOp[],
  token: string,
  deviceSettings: Record<string, unknown>,
) {
  const view = structuredClone(remote);
  for (const item of pending.filter((p) => p.token === token)) {
    try {
      projectLearnOp(view, item.op);
    } catch {
      /* An import earlier in the outbox may still be awaiting acknowledgement. */
    }
  }
  const data = cloudSnapshotToAnimeVocabExport({
    ...normalizeAnimeVocabExport({}),
    words: Object.values(view.words),
    daily: Object.values(view.daily),
    settings: view.settings,
  });
  return {
    vocab: data.vocab,
    stats: data.stats,
    settings: { ...deviceSettings, ...data.settings },
  };
}
export function mergeLearnChanges(
  remote: LearnState | undefined,
  pending: PendingLearnOp[],
  token: string,
  changes: LearnChange[],
) {
  const state = structuredClone(remote || emptyLearnState());
  for (const change of changes) applyLearnDelta(state, change.delta);
  const seen = new Set(changes.map((c) => c.op_id));
  return {
    state,
    pending: pending.filter((p) => p.token !== token || !seen.has(p.op.op_id)),
  };
}
