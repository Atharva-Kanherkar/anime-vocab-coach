import { describe, expect, it } from "vitest";
import { isSharedCacheKey, validateCacheKey } from "./validate";
import { normalizeWhisperResponse } from "./transcribe/normalize";

describe("cache keys", () => {
  it("shares only Japanese episode keys", () => {
    expect(isSharedCacheKey("youtube:abc123:ja")).toBe(true);
    expect(isSharedCacheKey("youtube:abc123:en")).toBe(false);
    expect(isSharedCacheKey("sess:Ab3dEf9h_k:ja")).toBe(false);
  });

  it("accepts transcribe-only keys for English audio and private sessions", () => {
    expect(validateCacheKey("netflix:81234567:en")).toBeNull();
    expect(validateCacheKey("sess:Ab3dEf9h_k-x:en")).toBeNull();
    expect(validateCacheKey("sess:Ab3dEf9h_k:ja")).toBeNull();
  });

  it("still rejects anything else", () => {
    for (const k of ["sess:short:ja", "sess:Ab3dEf9h_k:fr", "vimeo:1:ja", "youtube:a b:ja", "youtube:x:ja:extra"]) {
      expect(validateCacheKey(k)).not.toBeNull();
    }
  });
});

describe("Whisper normalization by language", () => {
  const raw = { segments: [{ start: 0, end: 1, text: "こんにちは" }, { start: 1, end: 2, text: "Good morning" }, { start: 2, end: 3, text: "♪" }] };

  it("keeps Japanese lines for Japanese audio", () => {
    expect(normalizeWhisperResponse(raw, 0, 48000).map((s) => s.text)).toEqual(["こんにちは"]);
  });

  it("keeps English lines for English audio instead of dropping them all", () => {
    expect(normalizeWhisperResponse(raw, 0, 48000, 24000, "en").map((s) => s.text)).toEqual(["Good morning"]);
  });
});
