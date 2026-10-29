// Test-only Node preload: give Next the same real Miniflare KV binding as the
// API Worker. Nothing from this file is imported by the app or its build.
if (process.env.N5_TEST_KV_URL && process.env.N5_TEST_KV_AUTH) {
  async function call(body) {
    const response = await fetch(process.env.N5_TEST_KV_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.N5_TEST_KV_AUTH}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Test KV unavailable");
    return response.json();
  }
  globalThis[Symbol.for("__cloudflare-context__")] = {
    env: { AVC_SYNC_KV: {
      get: async (key) => (await call({ op: "get", key })).value,
      put: async (key, value, options) => { await call({ op: "put", key, value, options }); },
    } },
  };
}
