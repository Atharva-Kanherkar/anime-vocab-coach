import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/n5-pilot.test.ts", "test/n5-listening-coordination.test.ts", "test/n5-capture-race.test.ts", "test/n5-boundaries.test.ts", "test/n5-course-context.test.ts"], environment: "node" } });
