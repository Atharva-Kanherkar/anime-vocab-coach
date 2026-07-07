import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The web app's own unit tests live next to the code in src/lib. An explicit
// config here stops the repo-root vitest config (scoped to the extension's
// test/) from being inherited when running `npm run test:unit` in web/.
export default defineConfig({
  // Mirror the "@/*" -> "src/*" path alias from tsconfig so tested modules can
  // import shared code (e.g. ai-coach.ts importing @/lib/site) the same way the
  // app does.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
