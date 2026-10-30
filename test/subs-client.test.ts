import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/storage", () => ({ getSyncToken: async () => "t" }));
import { SubTranslator, wordsToRead, type SubRequest, type SubResponse } from "../src/lib/subs-client";

const ok = (en: string): SubResponse => ({ ok: true, result: { en, readings: {} } });

describe("dual subtitle translations", () => {
  it("asks about kanji words only", () => {
    expect(wordsToRead([{ surface: "公生" }, { surface: "、" }, { surface: "ピアノ" }, { surface: "弾い" }])).toEqual([{ i: 0, s: "公生" }, { i: 3, s: "弾い" }]);
  });

  it("asks once per line, shares the answer and sends recent lines as context", async () => {
    const sent: SubRequest[] = [];
    const t = new SubTranslator(async (req) => { sent.push(req); return ok("en:" + req.line); });
    const [a, b] = await Promise.all([t.translate("一", [], "Show"), t.translate("一", [], "Show")]);
    expect(a).toEqual(b);
    await t.translate("二", [], "Show");
    await t.translate("三", [], "Show");
    expect(sent.map((r) => r.line)).toEqual(["一", "二", "三"]);
    expect(sent[2].context).toEqual(["一", "二"]);
    expect(sent[2].title).toBe("Show");
    expect(await t.peek("二")).toEqual({ en: "en:二", readings: {} });
  });

  it("retries a line after a blip but not after a refusal", async () => {
    const send = vi.fn<(req: SubRequest) => Promise<SubResponse>>()
      .mockResolvedValueOnce({ ok: false, error: "network" })
      .mockResolvedValueOnce(ok("Hello"))
      .mockResolvedValue({ ok: false, error: "subs_quota_exhausted" });
    const t = new SubTranslator(send);
    expect(await t.translate("一", [], null)).toBeNull();
    expect(t.lastError).toBe("network");
    expect(await t.translate("一", [], null)).toEqual({ en: "Hello", readings: {} });
    expect(await t.translate("二", [], null)).toBeNull();
    expect(await t.translate("二", [], null)).toBeNull();
    expect(send).toHaveBeenCalledTimes(3);
    expect(t.lastError).toBe("subs_quota_exhausted");
  });

  it("forgets on clear and keeps memory bounded", async () => {
    const send = vi.fn(async (req: SubRequest) => ok(req.line));
    const t = new SubTranslator(send);
    for (let i = 0; i < 450; i++) await t.translate("行" + i, [], null);
    expect(t.peek("行0")).toBeUndefined();
    expect(t.peek("行449")).toBeDefined();
    t.clear();
    expect(t.peek("行449")).toBeUndefined();
  });
});
