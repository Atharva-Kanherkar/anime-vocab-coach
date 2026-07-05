import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudSyncEnvelope } from "./sync";

interface SyncKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface SyncEnv {
  AVC_SYNC_KV?: SyncKV;
}

function syncKey(userId: string): string {
  return `sync:user:${userId}:snapshot:v1`;
}

async function getKV(): Promise<SyncKV | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as SyncEnv).AVC_SYNC_KV ?? null;
  } catch {
    return null;
  }
}

async function resolveStore(): Promise<SyncKV> {
  const kv = await getKV();
  if (!kv) throw new Error("AVC_SYNC_KV binding is required for cloud sync.");
  return kv;
}

export async function getCloudSyncEnvelope(userId: string): Promise<CloudSyncEnvelope | null> {
  const key = syncKey(userId);
  const store = await resolveStore();
  const raw = await store.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as CloudSyncEnvelope;
}

export async function putCloudSyncEnvelope(userId: string, envelope: CloudSyncEnvelope): Promise<void> {
  const key = syncKey(userId);
  const raw = JSON.stringify(envelope);
  const store = await resolveStore();
  await store.put(key, raw);
}
