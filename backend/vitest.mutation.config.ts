import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["src/n5/domain.test.ts", "src/n5/text.test.ts", "src/n5/curriculum.test.ts", "src/n5/tutor.test.ts"], environment: "node" } });
