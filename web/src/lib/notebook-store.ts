import { getLearnStore } from "./learn-server";
import type { NotebookStoreData } from "./notebooks";
export async function getNotebookStore(userId: string): Promise<NotebookStoreData> {
  const notebooks = await (await getLearnStore(userId)).readNotebooks();
  return { schemaVersion:1, notebooks:Object.values(notebooks).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)) };
}
