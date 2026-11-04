import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cloudAppUrl } from "../src/config";

/**
 * Review and progress live in the cloud app. The extension's own dashboard
 * page was a local file that knew nothing of the account, and every link to
 * it is gone; this keeps a new one from creeping back.
 */
const SRC = fileURLToPath(new URL("../src", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("review and dashboard links", () => {
  it("never open the local dashboard page", () => {
    const offenders = sources(SRC).filter(
      (path) => !path.endsWith("entries/dashboard.ts") && readFileSync(path, "utf8").includes("dashboard/dashboard.html")
    );
    expect(offenders).toEqual([]);
  });

  it("open the cloud app's review and progress screens", () => {
    for (const [file, section] of [
      ["entries/popup.ts", "review"],
      ["entries/content.ts", "review"],
      ["entries/welcome.ts", "progress"],
      ["lib/onboarding-ui.ts", "review"],
    ] as const) {
      expect(readFileSync(join(SRC, file), "utf8"), file).toMatch(new RegExp(`cloudAppUrl\\("${section}"`));
    }
  });

  it("point at /app with the section in the hash", () => {
    const url = new URL(cloudAppUrl("review", "popup_review"));
    expect(url.origin).toBe("https://animevocab.com");
    expect(url.pathname).toBe("/app");
    expect(url.hash).toBe("#review");
    expect(url.searchParams.get("utm_campaign")).toBe("popup_review");
  });
});
