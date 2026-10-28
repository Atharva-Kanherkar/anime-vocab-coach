import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/n5/domain.test.ts"], environment: "node" } });
