import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const compiled = await build({
  stdin: {
    contents: `export {CONTENT_VERSION as contentVersion} from './src/n5/course'; import {z} from 'zod'; import {enrolmentSchema,attemptSchema,eventSchema,heardSchema,answersSchema,finishSchema} from './src/n5/domain';
      export default Object.fromEntries(Object.entries({enrolment:enrolmentSchema,attempt:attemptSchema,event:eventSchema,heard:heardSchema,answers:answersSchema,finish:finishSchema}).map(([key,schema])=>[key,z.toJSONSchema(schema)]));`,
    resolveDir: process.cwd(),
  }, bundle: true, write: false, format: "esm", platform: "node",
});
const { default: requests, contentVersion } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const output = JSON.stringify({ apiVersion: 1, contentVersion, requests }, null, 2) + "\n";
const path = resolve("../shared/n5/requests.schema.json");
if (process.argv.includes("--check")) {
  if (await readFile(path, "utf8") !== output) throw new Error("N5 request schemas are stale. Run npm run contracts:n5.");
  console.log("N5 request schemas match runtime validation.");
} else { await writeFile(path, output); console.log("Wrote shared/n5/requests.schema.json"); }
