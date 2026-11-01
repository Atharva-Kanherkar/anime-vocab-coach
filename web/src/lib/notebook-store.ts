import { getLearnStore } from "./learn-server";
import type { NotebookStoreData } from "./notebooks";
export async function getNotebookStore(userId: string): Promise<NotebookStoreData> {
  const { state } = await (await getLearnStore(userId)).read();
  return { schemaVersion:1, notebooks:Object.values(state.notebooks).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)) };
}
