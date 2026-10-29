import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/lib/n5/*.fuzz.ts"], environment: "node", testTimeout: 30000 } });
