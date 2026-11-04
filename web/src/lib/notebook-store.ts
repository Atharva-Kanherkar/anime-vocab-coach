import { resolveStore } from "./sync-store";
import { emptyNotebookStore, normalizeNotebookStore, type NotebookStoreData } from "./notebooks";

// Notebooks live in the same KV as sync, under a single per-user key.
//
// Known v1 tradeoff: mutations are read-modify-write on this one blob with no
// revision check (unlike sync, which does optimistic concurrency). Two
// concurrent writes for the same user — even to different notebooks — race, and
// the last write wins, silently dropping the other. Acceptable for now: only
// human-speed web writes touch it (the extension writes sync, not notebooks) and
// the blast radius is a single entry. Fast-follow to remove it entirely: shard
// to per-notebook keys (`notebooks:user:X:nb:Y`) so cross-notebook clobber
// disappears and the whole-store rewrite / KV size ceiling goes away.
function notebookKey(userId: string): string {
  return `notebooks:user:${userId}:v1`;
}

export async function getNotebookStore(userId: string): Promise<NotebookStoreData> {
  const store = await resolveStore();
  const raw = await store.get(notebookKey(userId));
  if (!raw) return emptyNotebookStore();
  try {
    return normalizeNotebookStore(JSON.parse(raw));
  } catch {
    return emptyNotebookStore();
  }
}

export async function putNotebookStore(userId: string, data: NotebookStoreData): Promise<void> {
  const store = await resolveStore();
  await store.put(notebookKey(userId), JSON.stringify(data));
}
