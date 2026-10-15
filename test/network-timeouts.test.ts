import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ISO 25010 reliability audit: fetch() has no timeout of its own, and most of
// the extension's calls had none, so a stalled server left the UI waiting
// forever. Every network call in src/ must carry an abort signal.
const SRC = fileURLToPath(new URL("../src", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** The argument list of each fetch( call, paren-matched. */
function fetchCalls(source: string): string[] {
  const calls: string[] = [];
  const re = /\bfetch\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    let depth = 0;
    for (let i = m.index + 5; i < source.length; i++) {
      if (source[i] === "(") depth++;
      else if (source[i] === ")" && --depth === 0) {
        calls.push(source.slice(m.index, i + 1));
        break;
      }
    }
  }
  return calls;
}

describe("every extension network call has a timeout", () => {
  const offenders: string[] = [];
  for (const file of files(SRC)) {
    // Comments mention fetch() in prose; only code counts.
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const call of fetchCalls(source)) {
      // The bundled dictionary is a local extension file, not the network.
      if (call.includes("chrome.runtime.getURL")) continue;
      if (!/signal\s*:/.test(call)) offenders.push(`${file.slice(SRC.length + 1)}: ${call.split("\n")[0]}`);
    }
  }

  it("found the calls it is checking", () => {
    expect(files(SRC).map((f) => fetchCalls(readFileSync(f, "utf8")).length).reduce((a, b) => a + b, 0)).toBeGreaterThan(15);
  });

  it("has no fetch without an abort signal", () => {
    expect(offenders).toEqual([]);
  });
});
