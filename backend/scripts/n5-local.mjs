// Synthetic test identities and local-only D1/KV. Never use this harness to deploy.
import { runtime } from "../test/runtime.ts";
const app = await runtime();
console.log(`Private N5 preview: ${await app.mf.ready}`);
console.log("Synthetic local token: avc_st_n5local (has no access to production)");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await app.mf.dispose(); process.exit(0); });
