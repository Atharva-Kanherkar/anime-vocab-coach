import { getCloudflareContext } from "@opennextjs/cloudflare";
import { LearnStore, LearnError, type LearnDB } from "./learn-store";
import { getLegacyCloudSyncEnvelope, resolveStore } from "./sync-store";
import { normalizeNotebookStore } from "./notebooks";
import { newLearnOp, type LearnOp } from "./learn-protocol/model";
import { publicSettings } from "./learn-protocol/validate";
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
export async function getLearnStore(
  userId: string,
  options: { skipMigration?: boolean } = {},
): Promise<LearnStore> {
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as { LEARN_DB?: LearnDB }).LEARN_DB;
  if (!db) throw new LearnError("learner_store_unavailable", 503);
  const store = new LearnStore(db, userId);
  if (options.skipMigration) return store;
  if ((await store.read()).migrated) return store;
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
  for (let i = 0; i < ops.length; i += 50)
    await store.apply(ops.slice(i, i + 50));
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
export async function getLearnEnvelope(
  profile: CloudUserProfile,
): Promise<CloudSyncEnvelope> {
  const store = await getLearnStore(profile.id);
  const { state, revision } = await store.read();
  return {
    schemaVersion: 1,
    profile,
    revision,
    lastSyncedAt: new Date().toISOString(),
    snapshot: {
      ...normalizeAnimeVocabExport({}, new Date(0)),
      words: Object.values(state.words),
      daily: Object.values(state.daily),
      settings: state.settings,
    },
  };
}
