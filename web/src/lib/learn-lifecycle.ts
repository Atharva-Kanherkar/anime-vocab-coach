import { getLearnStore } from "./learn-server";
import { resolveStore } from "./sync-store";
async function eraseLegacyData(userId: string): Promise<void> {
  const kv = await resolveStore();
  await kv.put(`sync:user:${userId}:snapshot:v1`, "null");
  await kv.put(`notebooks:user:${userId}:v1`, "{}");
}
/** Self-serve "delete my learning data": erase everything but keep the account
 * usable. The new epoch makes other devices drop their cached copy. */
export async function resetLearnerAccount(userId: string): Promise<void> {
  await (await getLearnStore(userId, { skipMigration: true })).reset();
  await eraseLegacyData(userId);
}
/** Keep the minimal tombstone needed to stop old clients reimporting deleted data. */
export async function deleteLearnerAccount(userId: string): Promise<void> {
  await (await getLearnStore(userId, { skipMigration: true })).delete();
  const kv = await resolveStore();
  await kv.put(`learn:deleted:${userId}`, "1");
  await eraseLegacyData(userId);
}
