import { afterEach, describe, expect, it, vi } from "vitest";
import { VISITOR_COUNTRY_KEY, loadVisitorCountry } from "./use-visitor-country";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    raw: m,
  };
}

describe("loadVisitorCountry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns and caches a successful country", async () => {
    const store = memoryStorage();
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ country: "IN" }),
      })
    );

    await expect(loadVisitorCountry()).resolves.toBe("IN");
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("IN");
  });

  it("caches unknown country as empty so the next call does not refetch", async () => {
    const store = memoryStorage();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country: null }),
    });
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadVisitorCountry()).resolves.toBeNull();
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("");
    await expect(loadVisitorCountry()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache HTTP errors, so a later mount retries", async () => {
    const store = memoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ country: "VN" }) });
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadVisitorCountry()).resolves.toBeNull();
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBeNull();
    await expect(loadVisitorCountry()).resolves.toBe("VN");
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("VN");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache a thrown fetch, so a later mount retries", async () => {
    const store = memoryStorage();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ country: "PH" }) });
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadVisitorCountry()).resolves.toBeNull();
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBeNull();
    await expect(loadVisitorCountry()).resolves.toBe("PH");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a cached country without refetching", async () => {
    const store = memoryStorage();
    store.setItem(VISITOR_COUNTRY_KEY, "IN");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadVisitorCountry()).resolves.toBe("IN");
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("IN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not let a late HTTP error overwrite a successful cache write", async () => {
    const store = memoryStorage();
    let finishFail!: (value: { ok: boolean; status: number }) => void;
    const hungFail = new Promise<{ ok: boolean; status: number }>((resolve) => {
      finishFail = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ country: "IN" }),
      }))
      .mockImplementationOnce(() => hungFail);
    vi.stubGlobal("sessionStorage", store);
    vi.stubGlobal("fetch", fetchMock);

    const success = loadVisitorCountry();
    const failure = loadVisitorCountry();
    await expect(success).resolves.toBe("IN");
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("IN");
    finishFail({ ok: false, status: 502 });
    await expect(failure).resolves.toBeNull();
    expect(store.getItem(VISITOR_COUNTRY_KEY)).toBe("IN");
  });
});
