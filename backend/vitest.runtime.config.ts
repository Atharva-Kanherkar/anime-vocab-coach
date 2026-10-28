import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node", fileParallelism: false, hookTimeout: 30000, testTimeout: 30000 } });
