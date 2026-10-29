import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { mockOpenAI } from "./mock-openai";
const runtimeRoot = fileURLToPath(new URL("../", import.meta.url));

export async function runtime(options: { enabled?: string | null; allowed?: string; database?: boolean; persist?: string; migrationCount?: number; ai?: boolean } = {}) {
  const openai = mockOpenAI();
  const built = await build({ absWorkingDir: runtimeRoot, entryPoints: ["src/index.ts"], bundle: true, write: false, format: "esm", platform: "browser", target: "es2022" });
  const mf = new Miniflare({
    modules: true, script: built.outputFiles[0].text, compatibilityDate: "2026-06-01",
    bindings: { ...(options.enabled === null ? {} : { N5_ENABLED: options.enabled ?? "1" }), N5_PREVIEW_USERS: options.allowed ?? "n5-local-user,n5-other-user",
      // AI features default on against the mock; the real key never exists in tests.
      ...(options.ai === false ? {} : { N5_AI_ENABLED: "1" }), OPENAI_API_KEY: "test-openai-key", TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe" },
    outboundService: (request) => openai.handle(request as unknown as Request) as never,
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
    await db.prepare("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    // Recognize persisted databases created by the original one-migration harness.
    const legacy = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='n5_accounts'").first();
    if (legacy) await db.prepare("INSERT INTO d1_migrations(name) VALUES('0001_n5_preview.sql') ON CONFLICT DO NOTHING").run();
    const migrations = (await readdir(`${runtimeRoot}/migrations`)).filter((name) => name.endsWith(".sql")).sort().slice(0, options.migrationCount);
    for (const name of migrations) {
      if (await db.prepare("SELECT id FROM d1_migrations WHERE name=?").bind(name).first()) continue;
      const migration = await readFile(`${runtimeRoot}/migrations/${name}`, "utf8");
      await db.batch([
        ...migration.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)),
        db.prepare("INSERT INTO d1_migrations(name) VALUES(?)").bind(name),
      ]);
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
  return { mf, db, kv, request, openai };
}
