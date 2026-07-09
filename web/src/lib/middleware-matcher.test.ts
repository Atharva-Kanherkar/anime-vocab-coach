import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { match } from "path-to-regexp";
import { describe, expect, it } from "vitest";

// Regression test for the /studio production 500: any page that calls Clerk's
// currentUser()/auth() throws unless clerkMiddleware ran on the request, which
// only happens on routes the middleware `config.matcher` covers. This pins the
// matcher to keep covering every page route (and /app protection paths).
//
// The matcher is read from the source file rather than imported because
// importing middleware.ts pulls in @clerk/nextjs/server, which expects a Next
// runtime.
const source = readFileSync(
  fileURLToPath(new URL("../middleware.ts", import.meta.url)),
  "utf8"
);

function matcherPatterns(): string[] {
  const block = source.match(/matcher:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error("no matcher found in middleware.ts");
  return [...block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
    m[1].replace(/\\\\/g, "\\")
  );
}

function covered(path: string): boolean {
  return matcherPatterns().some((pattern) => {
    try {
      return match(pattern, { decode: decodeURIComponent })(path) !== false;
    } catch {
      return false;
    }
  });
}

describe("middleware matcher", () => {
  it("covers pages that call currentUser()", () => {
    // /studio is public but reads sign-in state — this was the prod 500.
    expect(covered("/studio")).toBe(true);
    expect(covered("/app")).toBe(true);
    expect(covered("/app/cards/abc")).toBe(true);
  });

  it("covers the API and Clerk proxy", () => {
    expect(covered("/api/sync/token")).toBe(true);
    expect(covered("/__clerk/v1/client")).toBe(true);
  });

  it("skips Next internals and static assets", () => {
    expect(covered("/_next/static/chunks/main.js")).toBe(false);
    expect(covered("/og.png")).toBe(false);
  });
});
