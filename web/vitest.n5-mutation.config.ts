import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/lib/n5/core.test.ts"], environment: "node" } });
