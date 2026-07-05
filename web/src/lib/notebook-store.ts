import { resolveStore } from "./sync-store";
import { emptyNotebookStore, normalizeNotebookStore, type NotebookStoreData } from "./notebooks";

// Notebooks live in the same KV as sync, under a per-user key.
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
