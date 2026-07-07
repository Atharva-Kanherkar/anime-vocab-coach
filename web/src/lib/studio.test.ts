import { describe, expect, it } from "vitest";
import {
  buildPanelPrompt,
  buildSketchPrompt,
  MAX_PANEL_B64_LEN,
  MAX_STUDIO_WORDS,
  MIN_STUDIO_PANELS,
  normalizeFinalizeRequest,
  normalizePanelArtRequest,
  normalizeScript,
  normalizeStudioRequest,
  toGalleryEntry,
  type StudioCreationMeta,
} from "./studio";

const words = [{ base: "夢", reading: "ゆめ", gloss: "dream" }];

function scriptJson(panelCount: number) {
  return {
    title: { en: "T", ja: "た", romaji: "ta" },
    cast: [
      { name: "Aki", look: "short black hair, red scarf" },
      { name: "Ren", look: "tall, glasses" },
    ],
    panels: Array.from({ length: panelCount }, (_, i) => ({
      art: `beat ${i}`,
      texts: [{ speaker: "Aki", ja: "夢だ", romaji: "yume da", en: "It's a dream" }],
    })),
  };
}

describe("normalizeStudioRequest (draft input)", () => {
  it("accepts a valid request and clamps word count", () => {
    const r = normalizeStudioRequest({
      styleKey: "slayer",
      premise: "hi",
      words: Array.from({ length: 9 }, (_, i) => ({ base: `w${i}`, gloss: "g" })),
    });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.words.length).toBe(MAX_STUDIO_WORDS);
  });

  it("rejects an unknown style", () => {
    expect(normalizeStudioRequest({ styleKey: "nope", words })).toEqual({ error: "invalid_style" });
  });

  it("rejects when no usable words are given", () => {
    expect(normalizeStudioRequest({ styleKey: "slayer", words: [{ base: "", gloss: "" }] })).toEqual({
      error: "no_words",
    });
  });
});

describe("normalizeScript", () => {
  it("parses cast and a valid panel count", () => {
    const out = normalizeScript(scriptJson(6));
    expect(out.panels.length).toBe(6);
    expect(out.cast.length).toBe(2);
    expect(out.cast[0].name).toBe("Aki");
  });

  it("throws when the script has too few panels", () => {
    expect(() => normalizeScript(scriptJson(MIN_STUDIO_PANELS - 1))).toThrow("studio_bad_script");
  });
});

describe("normalizePanelArtRequest", () => {
  it("accepts a text beat with no sketch", () => {
    const r = normalizePanelArtRequest({ styleKey: "neon", art: "two rivals in rain", cast: [] });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.sketchB64).toBe("");
  });

  it("strips the data URL prefix from a sketch", () => {
    const r = normalizePanelArtRequest({
      styleKey: "neon",
      art: "",
      cast: [],
      sketch: "data:image/png;base64,QUJD",
    });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.sketchB64).toBe("QUJD");
  });

  it("rejects an empty panel (no art, no sketch)", () => {
    expect(normalizePanelArtRequest({ styleKey: "neon", art: "", cast: [] })).toEqual({
      error: "empty_panel",
    });
  });

  it("rejects an oversized sketch", () => {
    const big = "A".repeat(MAX_PANEL_B64_LEN + 1);
    expect(normalizePanelArtRequest({ styleKey: "neon", art: "x", sketch: big })).toEqual({
      error: "sketch_too_large",
    });
  });

  it("rejects non-base64 sketch content", () => {
    expect(normalizePanelArtRequest({ styleKey: "neon", art: "x", sketch: "not base64 %%%" })).toEqual({
      error: "invalid_sketch",
    });
  });
});

describe("normalizeFinalizeRequest", () => {
  it("accepts an assembled manga", () => {
    const r = normalizeFinalizeRequest({
      title: { en: "My Manga", ja: "", romaji: "" },
      words,
      styleKey: "slayer",
      premise: "p",
      cast: [{ name: "Aki", look: "red scarf" }],
      panels: scriptJson(6).panels,
    });
    expect("req" in r).toBe(true);
    if ("req" in r) {
      expect(r.req.panels.length).toBe(6);
      expect(r.req.title.en).toBe("My Manga");
    }
  });

  it("rejects too few panels", () => {
    const r = normalizeFinalizeRequest({
      words,
      styleKey: "slayer",
      panels: scriptJson(MIN_STUDIO_PANELS - 1).panels,
    });
    expect(r).toEqual({ error: "too_few_panels" });
  });

  it("rejects when there are no words", () => {
    const r = normalizeFinalizeRequest({ words: [], styleKey: "slayer", panels: scriptJson(6).panels });
    expect(r).toEqual({ error: "no_words" });
  });
});

describe("prompt builders never allow baked text", () => {
  const cast = [{ name: "Aki", look: "red scarf" }];
  it("panel prompt forbids text and includes the scene", () => {
    const p = buildPanelPrompt("neon", "a quiet street", cast);
    expect(p).toContain("a quiet street");
    expect(p.toLowerCase()).toContain("no text");
    expect(p).toContain("Aki");
  });
  it("sketch prompt keeps composition and forbids text", () => {
    const p = buildSketchPrompt("neon", "a quiet street", cast);
    expect(p.toLowerCase()).toContain("sketch");
    expect(p.toLowerCase()).toContain("composition");
    expect(p.toLowerCase()).toContain("no text");
  });
});

describe("toGalleryEntry", () => {
  it("uses a safe author fallback and panel layout", () => {
    const meta: StudioCreationMeta = {
      id: "abc",
      ownerId: "u1",
      title: { en: "X", ja: "", romaji: "" },
      words,
      styleKey: "slayer",
      premise: "",
      panels: scriptJson(6).panels,
      layout: "panels",
      isPublic: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const g = toGalleryEntry(meta);
    expect(g.authorName).toBe("A learner");
    expect(g.layout).toBe("panels");
    expect(g.cover).toBe(0);
    expect(g.words).toEqual(["夢"]);
  });
});
