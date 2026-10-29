// Local N5 stack for manual testing: real workerd/KV/D1 API with a mock AI provider,
// plus `next dev` with Clerk disabled. Synthetic identities only; never deploy this.
// Usage: node e2e/n5-dev.mjs [port]   then open http://127.0.0.1:PORT/app/n5
import { spawn } from "node:child_process";
import { createServer as httpServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runtime } from "../../backend/test/runtime.ts";

const web = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] || 3055);
const app = await runtime({ allowed: "dev-user" });
const kvAuth = randomUUID();
const kvBridge = httpServer(async (req, res) => {
  try {
    if (req.method !== "POST" || req.headers.authorization !== `Bearer ${kvAuth}`) { res.writeHead(403).end(); return; }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const { op, key, value, options } = JSON.parse(raw);
    const result = op === "get" ? { value: await app.kv.get(key) } : op === "put" ? (await app.kv.put(key, value, options), {}) : null;
    if (result === null) throw new Error("Unknown operation");
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch { res.writeHead(500).end(); }
});
await new Promise((resolve) => kvBridge.listen(0, "127.0.0.1", resolve));
const child = spawn(process.execPath, ["--import", fileURLToPath(new URL("./n5-kv-binding.mjs", import.meta.url)), "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: web, stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development", N5_TEST_KV_URL: `http://127.0.0.1:${kvBridge.address().port}`, N5_TEST_KV_AUTH: kvAuth,
    NEXT_PUBLIC_AVC_DEV_NO_CLERK: "1", N5_WEB_PREVIEW_ENABLED: "1", N5_PREVIEW_USERS: "dev-user", N5_API_ORIGIN: (await app.mf.ready).origin, OPENAI_API_KEY: "" },
});
console.log(`N5 local stack: http://127.0.0.1:${port}/app/n5 (mock AI provider)`);
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { child.kill("SIGTERM"); kvBridge.close(); await app.mf.dispose(); process.exit(0); });
