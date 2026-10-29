import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/n5/*.fuzz.ts"], environment: "node" } });
