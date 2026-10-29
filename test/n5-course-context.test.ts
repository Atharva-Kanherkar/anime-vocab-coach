import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isN5Script,
  loadN5CourseContext,
  n5CourseStorageKey,
  parseN5CourseContext,
  saveN5CourseContext,
  type N5CourseContext,
} from "../src/lib/n5-course-context";

/**
 * N5 course context: strict parse of versioned backend context, pure-script
 * selection, and owner-namespaced local storage. Storage is the in-memory map
 * stubbed below; no chrome runtime needed for the pure parse contract.
 */
const local: Record<string, unknown> = {};

beforeEach(() => {
  for (const key of Object.keys(local)) delete local[key];
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn((keys: string[] | string, cb?: (r: Record<string, unknown>) => void) => {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = Object.fromEntries(list.map((k) => [k, structuredClone(local[k])]).filter(([, v]) => v !== undefined));
          if (cb) {
            cb(out);
            return undefined;
          }
          return Promise.resolve(out);
        }),
        set: vi.fn((value: Record<string, unknown>, cb?: () => void) => {
          Object.assign(local, structuredClone(value));
          if (cb) {
            cb();
            return undefined;
          }
          return Promise.resolve();
        }),
      },
    },
  });
});

function validContext(overrides: Partial<N5CourseContext> = {}): N5CourseContext {
  return {
    courseId: "n5-foundations",
    trackId: "your-lie-in-april-2014",
    unitId: "s1-u1",
    episodeId: "s1-e1",
    lessonId: "your-lie-in-april-s1-e1",
    contentVersion: "preview-1",
    script: "romaji",
    ...overrides,
  };
}

describe("parseN5CourseContext", () => {
  it("accepts a valid romaji context and preserves versioned ids", () => {
    expect(parseN5CourseContext(validContext())).toEqual(validContext());
  });

  it("accepts a valid kana context", () => {
    expect(parseN5CourseContext(validContext({ script: "kana" }))).toEqual(validContext({ script: "kana" }));
  });

  it("rejects non-object input", () => {
    expect(parseN5CourseContext(null)).toBeNull();
    expect(parseN5CourseContext(["courseId"])).toBeNull();
    expect(parseN5CourseContext("n5")).toBeNull();
  });

  it("rejects missing or mistyped required fields", () => {
    const base = validContext();
    expect(parseN5CourseContext({ ...base, courseId: undefined })).toBeNull();
    expect(parseN5CourseContext({ ...base, script: 3 })).toBeNull();
    expect(parseN5CourseContext({ ...base, contentVersion: 42 })).toBeNull();
  });

  it("rejects empty or oversized ids", () => {
    expect(parseN5CourseContext(validContext({ lessonId: "" }))).toBeNull();
    expect(parseN5CourseContext(validContext({ episodeId: "x".repeat(129) }))).toBeNull();
  });

  it("rejects unknown fields, mirroring the backend strict schema", () => {
    const ctx = validContext() as unknown as Record<string, unknown>;
    ctx.injected = "attacker";
    expect(parseN5CourseContext(ctx)).toBeNull();
  });
});

describe("isN5Script", () => {
  it("accepts only the two pure scripts", () => {
    expect(isN5Script("romaji")).toBe(true);
    expect(isN5Script("kana")).toBe(true);
    expect(isN5Script("kanji")).toBe(false);
    expect(isN5Script("romaji-kana")).toBe(false);
    expect(isN5Script(null)).toBe(false);
  });
});

describe("n5 course storage", () => {
  it("round-trips a validated context under the owner-namespaced key", async () => {
    const ctx = validContext({ script: "kana" });
    await expect(saveN5CourseContext("user_1", ctx)).resolves.toBe(true);
    expect(await loadN5CourseContext("user_1")).toEqual(ctx);
    expect(Object.keys(local)).toEqual([n5CourseStorageKey("user_1")]);
  });

  it("rejects saving an unvalidated context and loading garbage", async () => {
    await expect(saveN5CourseContext("user_1", null)).resolves.toBe(false);
    local[n5CourseStorageKey("user_1")] = { courseId: "n5-foundations", script: "romaji" };
    await expect(saveN5CourseContext("user_1", validContext())).resolves.toBe(true);
    expect(await loadN5CourseContext("user_1")).toEqual(validContext());
    local[n5CourseStorageKey("user_2")] = { courseId: "n5-foundations", script: "romaji" };
    expect(await loadN5CourseContext("user_2")).toBeNull();
  });
});
