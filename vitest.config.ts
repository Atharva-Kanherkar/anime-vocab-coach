import { defineConfig } from "vitest/config";

// Root runner owns the extension's pure logic tests under test/. The web app
// has its own runner (web/ vitest), so scope this one to test/ to avoid pulling
// web specs into the extension test run.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
