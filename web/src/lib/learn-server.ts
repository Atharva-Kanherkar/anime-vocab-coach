import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LearnStore, LearnError, type LearnDB } from "./learn-store";
import { getLegacyCloudSyncEnvelope, resolveStore } from "./sync-store";
import { normalizeNotebookStore } from "./notebooks";
import {
  newLearnOp,
  type LearnOp,
  type LearnState,
} from "./learn-protocol/model";
import { publicSettings, validateLearnOps } from "./learn-protocol/validate";
import {
  normalizeAnimeVocabExport,
  type CloudSyncEnvelope,
  type CloudSyncSnapshot,
  type CloudUserProfile,
} from "./sync";

export function snapshotImportOps(
  snapshot: CloudSyncSnapshot,
  prefix: string,
): LearnOp[] {
  const at = "2000-01-01T00:00:00.000Z";
  return [
    ...snapshot.words.map((word, i) =>
      newLearnOp("import_local", { word }, `${prefix}:word:${i}`, at),
    ),
    ...snapshot.daily.map((daily, i) =>
      newLearnOp("import_local", { daily }, `${prefix}:day:${i}`, at),
    ),
    newLearnOp(
      "import_local",
      { settings: publicSettings(snapshot.settings) },
      `${prefix}:settings`,
      at,
    ),
  ];
}
/**
 * Only the imports that add something. Legacy clients re-upload their whole
 * deck on every sync; without this each upload appended a no-op operation per
 * word to the change log every device replays.
 */
export function newImportOps(state: LearnState, ops: LearnOp[]): LearnOp[] {
  return ops.flatMap((op) => {
    const p = op.payload;
    const word = p.word as { base: string } | undefined;
    const daily = p.daily as { day: string } | undefined;
    if (word) return state.words[word.base] ? [] : [op];
    if (daily) return state.daily[daily.day] ? [] : [op];
    const settings = Object.fromEntries(
      Object.entries((p.settings as Record<string, unknown>) || {}).filter(
        ([k]) => !(k in state.settings),
      ),
    );
    return Object.keys(settings).length
      ? [{ ...op, payload: { settings } }]
      : [];
  });
}
const skippable = (err: unknown) =>
  err instanceof LearnError
    ? err.status === 404 || err.message === "operation_id_reused"
    : err instanceof Error && /^invalid_/.test(err.message);
/** One malformed legacy record must not block the rest of the account. */
async function importLegacy(store: LearnStore, ops: LearnOp[]) {
  const valid = ops.filter((op) => {
    try {
      validateLearnOps([op]);
      return true;
    } catch {
      console.warn("[learn] skipped invalid legacy record", op.op_id);
      return false;
    }
  });
  for (let i = 0; i < valid.length; i += 50) {
    const page = valid.slice(i, i + 50);
    try {
      await store.apply(page);
    } catch (err) {
      if (!skippable(err)) throw err;
      for (const op of page) {
        try {
          await store.apply([op]);
        } catch (e) {
          if (!skippable(e)) throw e;
          console.warn("[learn] skipped legacy record", op.op_id, (e as Error).message);
        }
      }
    }
  }
}
export async function getLearnStore(
  userId: string,
  options: { skipMigration?: boolean } = {},
): Promise<LearnStore> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as { LEARN_DB?: LearnDB }).LEARN_DB;
  if (!db) throw new LearnError("learner_store_unavailable", 503);
  const store = new LearnStore(db, userId);
  if (options.skipMigration) return store;
  if ((await store.account()).migrated) return store;
  const kv = await resolveStore();
  const legacy = await getLegacyCloudSyncEnvelope(userId);
  const notebooks = normalizeNotebookStore(
    JSON.parse((await kv.get(`notebooks:user:${userId}:v1`)) || "{}"),
  );
  const ops = legacy ? snapshotImportOps(legacy.snapshot, "legacy-kv") : [];
  for (const review of legacy?.webReviews || []) {
    ops.push(
      newLearnOp(
        "review_history",
        {
          base: review.base,
          result: review.result,
          day: review.at.slice(0, 10),
        },
        `legacy-review:${review.seq}`,
        review.at,
      ),
    );
  }
  for (const nb of notebooks.notebooks) {
    ops.push(
      newLearnOp(
        "notebook",
        { notebook: { ...nb, entries: [] } },
        `legacy-nb:${nb.id}`,
        nb.createdAt,
      ),
    );
    for (const entry of nb.entries)
      ops.push(
        newLearnOp(
          "notebook_item",
          { id: nb.id, entry },
          `legacy-item:${nb.id}:${entry.id}`,
          entry.createdAt,
        ),
      );
  }
  await importLegacy(store, ops);
  // An empty store still gets a durable migration marker.
  await store.apply(
    [
      newLearnOp(
        "settings",
        { settings: {} },
        "migration-complete",
        "2000-01-01T00:00:00.000Z",
      ),
    ],
    { migrated: true },
  );
  return store;
}
export function snapshotFromState(state: LearnState): CloudSyncSnapshot {
  return {
    ...normalizeAnimeVocabExport({}, new Date(0)),
    words: Object.values(state.words),
    daily: Object.values(state.daily),
    settings: state.settings,
  };
}
export function envelopeFromState(
  profile: CloudUserProfile,
  state: LearnState,
  revision: number,
): CloudSyncEnvelope {
  return {
    schemaVersion: 1,
    profile,
    revision,
    lastSyncedAt: new Date().toISOString(),
    snapshot: snapshotFromState(state),
  };
}
export async function getLearnEnvelope(
  profile: CloudUserProfile,
  store?: LearnStore,
): Promise<CloudSyncEnvelope> {
  const { state, revision } = await (
    store || (await getLearnStore(profile.id))
  ).read({ notebooks: false });
  return envelopeFromState(profile, state, revision);
}
