import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFile } from "node:fs/promises";

export async function runtime(options: { enabled?: string; allowed?: string; database?: boolean; persist?: string } = {}) {
  const built = await build({ entryPoints: ["src/index.ts"], bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  const mf = new Miniflare({
    modules: true, script: built.outputFiles[0].text, compatibilityDate: "2026-06-01",
    bindings: { N5_ENABLED: options.enabled ?? "1", N5_PREVIEW_USERS: options.allowed ?? "n5-local-user,n5-other-user" },
    kvNamespaces: ["AVC_KV"], d1Databases: options.database === false ? {} : { N5_DB: "n5-preview-test" },
    ...(options.persist ? { d1Persist: options.persist } : {}),
  });
  await mf.ready;
  const kv = await mf.getKVNamespace("AVC_KV");
  for (const [token, userId] of [["avc_st_n5local", "n5-local-user"], ["avc_st_n5other", "n5-other-user"], ["avc_st_denied", "not-in-preview"]]) {
    await kv.put(`synctoken:${token}:v1`, JSON.stringify({ id: userId, email: null, name: null, plan: "free", touchedAt: Date.now() }));
  }
  const db = options.database === false ? null : await mf.getD1Database("N5_DB");
  if (db) {
    const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='n5_accounts'").first();
    if (!exists) {
      const migration = await readFile("migrations/0001_n5_preview.sql", "utf8");
      await db.batch(migration.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
    }
  }
  async function request(path: string, options: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string>; raw?: string } = {}) {
    return mf.dispatchFetch(`http://localhost/v1/n5${path}`, {
      method: options.method ?? (options.body === undefined && options.raw === undefined ? "GET" : "POST"),
      headers: {
        ...(options.token === null ? {} : { Authorization: `Bearer ${options.token ?? "avc_st_n5local"}` }),
        ...(options.body === undefined && options.raw === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      ...(options.body === undefined && options.raw === undefined ? {} : { body: options.raw ?? JSON.stringify(options.body) }),
    });
  }
  return { mf, db, kv, request };
}
