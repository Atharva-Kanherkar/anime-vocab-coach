import { defineConfig } from "vitest/config";

// The web app's own unit tests live next to the code in src/lib. An explicit
// config here stops the repo-root vitest config (scoped to the extension's
// test/) from being inherited when running `npm run test:unit` in web/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
