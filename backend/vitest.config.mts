import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Backend unit tests live next to the code in src/. An explicit config stops
// the repo-root vitest config (scoped to the extension's test/) from being
// inherited when running `npm test` in backend/ — same pattern as web/.
export default defineConfig({
  resolve: {
    alias: {
      // Workers runtime module; Node gets a minimal stand-in (see the stub).
      "cloudflare:workers": fileURLToPath(new URL("./test-stubs/cloudflare-workers.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
