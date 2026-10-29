import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/n5-*.fuzz.ts"], environment: "node", testTimeout: 30000 } });
