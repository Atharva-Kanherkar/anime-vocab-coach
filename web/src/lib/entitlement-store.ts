import type { Entitlement } from "./plans";
import { entitlementKey, FREE_ENTITLEMENT, parseEntitlement } from "./plans";
import { resolveStore } from "./sync-store";

export async function putUserEntitlement(userId: string, entitlement: Entitlement): Promise<void> {
  const store = await resolveStore();
  await store.put(entitlementKey(userId), JSON.stringify(entitlement));
}

export async function getUserEntitlement(userId: string): Promise<Entitlement> {
  const store = await resolveStore();
  const raw = await store.get(entitlementKey(userId));
  if (!raw) return { ...FREE_ENTITLEMENT };
  try {
    return parseEntitlement(JSON.parse(raw) as unknown);
  } catch {
    return { ...FREE_ENTITLEMENT };
  }
}
