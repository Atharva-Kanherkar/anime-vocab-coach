import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Pins the transcription Analytics Engine layout identical across the two
 * Workers that share it.
 *
 * The writer lives in the avc-api Worker (backend/src/telemetry-schema.ts) and
 * the reader lives in the web app's /owner dashboard
 * (web/src/lib/telemetry-schema.ts). They are separate builds with no shared
 * module, so the lists are duplicated by hand.
 *
 * This is worth a test rather than a comment because AE has no schema: SQL
 * addresses columns positionally as blob1..blob20. If the writer puts
 * `language` in blob7 and the reader believes blob7 is `country`, nothing
 * fails. No type error, no runtime error, no empty panel. The dashboard just
 * reports confidently wrong numbers forever, and the historical rows keep the
 * old meaning even after someone notices.
 *
 * Reading the files as text (rather than importing across the two build
 * boundaries) is the same approach test/listening-billing.test.ts uses.
 */

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), "utf8");

/** Pull `export const NAME = [ ... ] as const;` and return the string items. */
function arrayLiteral(source: string, name: string): string[] {
  const m = new RegExp(`export const ${name}[^=]*=\\s*\\[([^\\]]*)\\]`).exec(source);
  if (!m) throw new Error(`could not find ${name} in source`);
  return [...m[1]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
}

/** Pull `export const NAME = "value";` */
function stringLiteral(source: string, name: string): string {
  const m = new RegExp(`export const ${name}[^=]*=\\s*"([^"]+)"`).exec(source);
  if (!m) throw new Error(`could not find ${name} in source`);
  return m[1]!;
}

const backend = read("backend/src/telemetry-schema.ts");
const web = read("web/src/lib/telemetry-schema.ts");

describe("transcription telemetry schema mirror", () => {
  it("agrees on the dataset name", () => {
    expect(stringLiteral(web, "TRANSCRIBE_DATASET")).toBe(
      stringLiteral(backend, "TRANSCRIBE_DATASET")
    );
  });

  it("agrees on blob order, exactly", () => {
    // Order is the whole point: these map to blob1..blobN positionally.
    expect(arrayLiteral(web, "TRANSCRIBE_BLOBS")).toEqual(
      arrayLiteral(backend, "TRANSCRIBE_BLOBS")
    );
  });

  it("agrees on double order, exactly", () => {
    expect(arrayLiteral(web, "TRANSCRIBE_DOUBLES")).toEqual(
      arrayLiteral(backend, "TRANSCRIBE_DOUBLES")
    );
  });

  it("agrees on the outcome vocabulary", () => {
    expect(arrayLiteral(web, "TRANSCRIBE_OUTCOMES")).toEqual(
      arrayLiteral(backend, "TRANSCRIBE_OUTCOMES")
    );
  });

  it("stays inside Analytics Engine's 20 blob / 20 double limit", () => {
    expect(arrayLiteral(backend, "TRANSCRIBE_BLOBS").length).toBeLessThanOrEqual(20);
    expect(arrayLiteral(backend, "TRANSCRIBE_DOUBLES").length).toBeLessThanOrEqual(20);
  });

  it("has no duplicate field names within a list", () => {
    for (const name of ["TRANSCRIBE_BLOBS", "TRANSCRIBE_DOUBLES"]) {
      const items = arrayLiteral(backend, name);
      expect(new Set(items).size, `${name} has a duplicate`).toBe(items.length);
    }
  });
});
