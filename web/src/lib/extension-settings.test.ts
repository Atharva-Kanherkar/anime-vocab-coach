import { describe, expect, it } from "vitest";
import {
  DISPLAY_SCRIPTS,
  parseExtensionSettings,
  settingsToRecord,
  type DisplayScript,
} from "./extension-settings";

/**
 * The validator used to test displayScript against a hand-written literal list.
 * Adding a script to the type without touching that list made cloud sync
 * silently reset the learner's choice back to the default — a setting that
 * worked in the extension until the web app synced over it. These tests pin the
 * round-trip so a new script can't be half-added again.
 */
describe("parseExtensionSettings — displayScript", () => {
  it("preserves every script in DISPLAY_SCRIPTS through a sync round-trip", () => {
    for (const script of DISPLAY_SCRIPTS) {
      const parsed = parseExtensionSettings({ displayScript: script }, "en");
      expect(parsed.displayScript, `${script} must survive parsing`).toBe(script);
      // A full round-trip is what cloud sync actually does.
      const round = parseExtensionSettings(settingsToRecord(parsed), "en");
      expect(round.displayScript, `${script} must survive a round-trip`).toBe(script);
    }
  });

  it("accepts the dual romaji+kana script", () => {
    expect(DISPLAY_SCRIPTS).toContain("romaji-kana");
    expect(parseExtensionSettings({ displayScript: "romaji-kana" }, "en").displayScript).toBe(
      "romaji-kana"
    );
  });

  it("falls back to the default for an unknown script", () => {
    const parsed = parseExtensionSettings({ displayScript: "emoji" }, "en");
    expect(DISPLAY_SCRIPTS).toContain(parsed.displayScript);
    expect(parsed.displayScript).toBe("romaji");
  });

  it("falls back when displayScript is missing entirely", () => {
    expect(parseExtensionSettings({}, "en").displayScript).toBe("romaji");
  });

  it("has no script in the type that is missing from DISPLAY_SCRIPTS", () => {
    // Compile-time guard: this fails to typecheck if a DisplayScript member is
    // added to the union but not to the runtime list.
    const exhaustive: Record<DisplayScript, true> = {
      romaji: true,
      "romaji-kana": true,
      kana: true,
      kanji: true,
    };
    expect(Object.keys(exhaustive).sort()).toEqual([...DISPLAY_SCRIPTS].sort());
  });
});
