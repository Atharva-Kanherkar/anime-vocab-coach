import { getLearnStore } from "./learn-server";
import { resolveStore } from "./sync-store";
/** Keep the minimal tombstone needed to stop old clients reimporting deleted data. */
export async function deleteLearnerAccount(userId: string): Promise<void> {
  await (await getLearnStore(userId, { skipMigration: true })).delete();
  const kv = await resolveStore();
  await kv.put(`learn:deleted:${userId}`, "1");
  await kv.put(`sync:user:${userId}:snapshot:v1`, "null");
  await kv.put(`notebooks:user:${userId}:v1`, "{}");
}
