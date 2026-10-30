import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/course-listening.test.ts", "test/n5-listening-coordination.test.ts", "test/n5-capture-race.test.ts"], environment: "node" } });
