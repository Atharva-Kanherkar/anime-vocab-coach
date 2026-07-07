import { describe, expect, it } from "vitest";
import {
  buildPanelPrompt,
  buildSketchPrompt,
  MAX_PANEL_B64_LEN,
  MIN_STUDIO_PANELS,
  normalizeFinalizeRequest,
  normalizePanelArtRequest,
  normalizeScript,
  normalizeStudioRequest,
  toGalleryEntry,
  type StudioCreationMeta,
} from "./studio";

function scriptJson(panelCount: number) {
  return {
    title: { en: "Blood Moon Duel", sub: "第一話" },
    logline: "A retired swordsman answers one last challenge.",
    cast: [
      { name: "Kaito", look: "spiky white hair, red coat, scar over left eye" },
      { name: "Rei", look: "tall, black kimono, calm eyes" },
    ],
    panels: Array.from({ length: panelCount }, (_, i) => ({
      scene: `beat ${i}`,
      lines: [
        { kind: "narration", speaker: "ignored", text: "The moon turned red." },
        { kind: "speech", speaker: "Kaito", text: "So you came." },
      ],
    })),
  };
}

describe("normalizeStudioRequest (draft input)", () => {
  it("accepts a premise + style", () => {
    const r = normalizeStudioRequest({ styleKey: "slayer", premise: "a duel", genre: "Shonen action" });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.language).toBe("English");
  });

  it("accepts genre-only (surprise me)", () => {
    expect("req" in normalizeStudioRequest({ styleKey: "neon", genre: "Horror" })).toBe(true);
  });

  it("rejects an unknown style", () => {
    expect(normalizeStudioRequest({ styleKey: "nope", premise: "x" })).toEqual({ error: "invalid_style" });
  });

  it("rejects when there's no concept and no genre", () => {
    expect(normalizeStudioRequest({ styleKey: "slayer", premise: "  " })).toEqual({ error: "empty_concept" });
  });
});

describe("normalizeScript", () => {
  it("parses title, logline, cast, and typed lines", () => {
    const out = normalizeScript(scriptJson(6));
    expect(out.panels.length).toBe(6);
    expect(out.title.sub).toBe("第一話");
    expect(out.logline).toContain("swordsman");
    expect(out.cast[0].name).toBe("Kaito");
    // narration lines never carry a speaker
    expect(out.panels[0].lines[0]).toEqual({ kind: "narration", speaker: "", text: "The moon turned red." });
    expect(out.panels[0].lines[1].kind).toBe("speech");
  });

  it("defaults an unknown line kind to speech", () => {
    const out = normalizeScript({
      title: { en: "T", sub: "" },
      cast: [],
      panels: Array.from({ length: 3 }, () => ({
        scene: "s",
        lines: [{ kind: "banana", speaker: "A", text: "hi" }],
      })),
    });
    expect(out.panels[0].lines[0].kind).toBe("speech");
  });

  it("throws when the script has too few panels", () => {
    expect(() => normalizeScript(scriptJson(MIN_STUDIO_PANELS - 1))).toThrow("studio_bad_script");
  });
});

describe("normalizePanelArtRequest", () => {
  it("accepts a scene beat with no sketch", () => {
    const r = normalizePanelArtRequest({ styleKey: "neon", scene: "two rivals in rain", cast: [] });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.sketchB64).toBe("");
  });

  it("strips the data URL prefix from a sketch", () => {
    const r = normalizePanelArtRequest({ styleKey: "neon", scene: "", cast: [], sketch: "data:image/png;base64,QUJD" });
    expect("req" in r).toBe(true);
    if ("req" in r) expect(r.req.sketchB64).toBe("QUJD");
  });

  it("rejects an empty panel (no scene, no sketch)", () => {
    expect(normalizePanelArtRequest({ styleKey: "neon", scene: "", cast: [] })).toEqual({ error: "empty_panel" });
  });

  it("rejects an oversized sketch", () => {
    const big = "A".repeat(MAX_PANEL_B64_LEN + 1);
    expect(normalizePanelArtRequest({ styleKey: "neon", scene: "x", sketch: big })).toEqual({
      error: "sketch_too_large",
    });
  });

  it("rejects non-base64 sketch content", () => {
    expect(normalizePanelArtRequest({ styleKey: "neon", scene: "x", sketch: "not base64 %%%" })).toEqual({
      error: "invalid_sketch",
    });
  });
});

describe("normalizeFinalizeRequest", () => {
  it("accepts an assembled chapter", () => {
    const r = normalizeFinalizeRequest({
      title: { en: "My Manga", sub: "" },
      logline: "x",
      genre: "Horror",
      tone: "Dark & moody",
      setting: "a lighthouse",
      language: "English",
      styleKey: "shadow",
      cast: [{ name: "Kaito", look: "red coat" }],
      panels: scriptJson(6).panels,
    });
    expect("req" in r).toBe(true);
    if ("req" in r) {
      expect(r.req.panels.length).toBe(6);
      expect(r.req.genre).toBe("Horror");
    }
  });

  it("rejects too few panels", () => {
    const r = normalizeFinalizeRequest({ styleKey: "slayer", panels: scriptJson(MIN_STUDIO_PANELS - 1).panels });
    expect(r).toEqual({ error: "too_few_panels" });
  });
});

describe("prompt builders never allow baked text", () => {
  const cast = [{ name: "Kaito", look: "red coat" }];
  it("panel prompt forbids text and includes the scene + cast", () => {
    const p = buildPanelPrompt("neon", "a quiet street", cast);
    expect(p).toContain("a quiet street");
    expect(p.toLowerCase()).toContain("no text");
    expect(p).toContain("Kaito");
  });
  it("sketch prompt keeps composition and forbids text", () => {
    const p = buildSketchPrompt("neon", "a quiet street", cast);
    expect(p.toLowerCase()).toContain("sketch");
    expect(p.toLowerCase()).toContain("composition");
    expect(p.toLowerCase()).toContain("no text");
  });
});

describe("toGalleryEntry", () => {
  it("uses a safe author fallback, genre, and panel layout", () => {
    const meta: StudioCreationMeta = {
      id: "abc",
      ownerId: "u1",
      title: { en: "X", sub: "" },
      logline: "",
      genre: "Isekai fantasy",
      tone: "Epic",
      setting: "",
      language: "English",
      styleKey: "slayer",
      cast: [],
      panels: scriptJson(6).panels as StudioCreationMeta["panels"],
      layout: "panels",
      isPublic: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const g = toGalleryEntry(meta);
    expect(g.authorName).toBe("Anonymous");
    expect(g.layout).toBe("panels");
    expect(g.genre).toBe("Isekai fantasy");
    expect(g.cover).toBe(0);
  });
});
