import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ISO 25010 reliability audit: every call this Worker makes to another service
// carries an abort signal (see upstream.ts). Browser-side calls to our own
// /api are bounded through these, so they are not scanned.
const SRC = fileURLToPath(new URL("..", import.meta.url));
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !n.includes(".test.") ? [p] : [];
  });

function externalFetches(source: string): string[] {
  const out: string[] = [];
  const re = /\bfetch\(\s*[`"](https:\/\/[^`"]+)|\bfetch\(\s*`\$\{SQL_API\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    for (let i = source.indexOf("(", m.index); i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")" && --depth === 0) {
        out.push(source.slice(m.index, i + 1));
        break;
      }
    }
  }
  return out;
}

describe("upstream calls are bounded", () => {
  const all = files(SRC).flatMap((f) => externalFetches(readFileSync(f, "utf8")).map((c) => ({ f, c })));

  it("finds the OpenAI, analytics and IndexNow calls", () => {
    expect(all.length).toBeGreaterThanOrEqual(20);
  });

  it("gives every one an abort signal", () => {
    expect(all.filter(({ c }) => !/signal\s*:/.test(c)).map(({ f, c }) => `${f.slice(SRC.length)}: ${c.split("\n")[0]}`)).toEqual([]);
  });
});
