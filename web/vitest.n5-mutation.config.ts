import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/lib/n5/core.test.ts", "src/lib/n5/attempt-state.test.ts", "src/lib/n5/credential.test.ts", "src/lib/n5/credential-record.test.ts", "src/lib/n5/drill.test.ts"], environment: "node" },
});
