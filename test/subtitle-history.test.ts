import { describe, expect, it } from "vitest";
import { SubtitleHistory } from "../src/lib/subtitle-history";

describe("SubtitleHistory", () => {
  it("returns the subtitle that was on screen when the speech began", () => {
    const h = new SubtitleHistory();
    h.record(10, "Where are you going?");
    h.record(12.4, "");
    h.record(13, "Home.");
    // The transcript for speech at 11s lands at 14s, when "Home." is up.
    expect(h.textAt(11)).toBe("Where are you going?");
    expect(h.textAt(13.5)).toBe("Home.");
  });

  it("looks a beat ahead when the screen was blank as the voice started", () => {
    const h = new SubtitleHistory();
    h.record(10, "");
    h.record(10.6, "I'm sorry.");
    expect(h.textAt(10.2)).toBe("I'm sorry.");
    expect(h.textAt(10.2, 0.2)).toBe("");
  });

  it("returns null outside what was sampled, so callers can fall back", () => {
    const h = new SubtitleHistory();
    expect(h.textAt(5)).toBeNull();
    h.record(10, "Hi.");
    expect(h.textAt(9)).toBeNull();
  });

  it("drops later moments after a seek back instead of mixing timelines", () => {
    const h = new SubtitleHistory();
    h.record(100, "Later line.");
    h.record(102, "Even later.");
    h.record(20, "Earlier line.");
    expect(h.textAt(101)).toBe("Earlier line.");
    h.record(22, "Next.");
    expect(h.textAt(21)).toBe("Earlier line.");
    expect(h.textAt(22.5)).toBe("Next.");
  });

  it("records only changes", () => {
    const h = new SubtitleHistory();
    h.record(1, "Same.");
    h.record(1.2, "Same.");
    h.record(1.4, "Same.");
    h.record(2, "New.");
    expect(h.textAt(1.3)).toBe("Same.");
    expect(h.textAt(2.1)).toBe("New.");
  });
});
