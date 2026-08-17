import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture what would be handed to Resend without touching the network.
const batchSend = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    batch = { send: batchSend };
    emails = { send: vi.fn() };
  },
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    throw new Error("no cloudflare context in tests");
  },
}));

const { escapeHtml, maxGiftEmailCopy, feedbackEmailCopy, bulkMailHeaders, sendEmailBatch, BATCH_MAX } =
  await import("./email");

const EXPIRES = "2026-10-15T00:00:00.000Z";

describe("escapeHtml", () => {
  it("escapes markup-significant characters", () => {
    expect(escapeHtml(`<b>&"'x`)).toBe("&lt;b&gt;&amp;&quot;&#39;x");
  });
});

describe("maxGiftEmailCopy", () => {
  it("escapes HTML in a user-controlled name", () => {
    const { html, text } = maxGiftEmailCopy({ name: "<img src=x>Bob", expiresAt: EXPIRES });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    // Plaintext body stays raw — nothing renders it as markup.
    expect(text).toContain("Hey <img,");
  });

  it("uses only the first word of the name", () => {
    const { text } = maxGiftEmailCopy({ name: "Sakura Haruno", expiresAt: EXPIRES });
    expect(text.startsWith("Hey Sakura,")).toBe(true);
  });

  it("falls back to a generic greeting for null or whitespace-only names", () => {
    expect(maxGiftEmailCopy({ name: null, expiresAt: EXPIRES }).text.startsWith("Hey,")).toBe(true);
    expect(maxGiftEmailCopy({ name: "   ", expiresAt: EXPIRES }).text.startsWith("Hey,")).toBe(
      true
    );
  });

  it("renders the UTC expiry date in both bodies", () => {
    const { text, html } = maxGiftEmailCopy({ name: "Bob", expiresAt: EXPIRES });
    expect(text).toContain("October 15, 2026");
    expect(html).toContain("October 15, 2026");
  });
});

describe("feedbackEmailCopy", () => {
  it("escapes HTML in a user-controlled name", () => {
    const { html } = feedbackEmailCopy({ name: "<img src=x>Bob" });
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
  });

  it("greets by first name and falls back when absent", () => {
    expect(feedbackEmailCopy({ name: "Sakura Haruno" }).text.startsWith("Hey Sakura,")).toBe(true);
    expect(feedbackEmailCopy({ name: null }).text.startsWith("Hey,")).toBe(true);
    expect(feedbackEmailCopy({ name: "  " }).text.startsWith("Hey,")).toBe(true);
  });

  // Requested explicitly: no em dashes in this copy. En dashes are barred too,
  // since they read the same way and creep in from the same habit.
  it("contains no em or en dashes in either body", () => {
    const { subject, text, html } = feedbackEmailCopy({ name: "Bob" });
    for (const body of [subject, text, html]) {
      expect(body).not.toMatch(/[—–]/);
    }
  });

  it("gives the reader an opt-out in both bodies", () => {
    const { text, html } = feedbackEmailCopy({ name: null });
    expect(text.toLowerCase()).toContain("stop");
    expect(html.toLowerCase()).toContain("stop");
  });

  it("offers a List-Unsubscribe header for bulk sends", () => {
    expect(bulkMailHeaders("me@example.com")["List-Unsubscribe"]).toBe(
      "<mailto:me@example.com?subject=unsubscribe>"
    );
  });
});

describe("sendEmailBatch", () => {
  beforeEach(() => {
    batchSend.mockReset();
    vi.stubEnv("RESEND_API_KEY", "re_test");
  });

  const mail = (to: string) => ({ to, subject: "s", text: "t" });

  it("sends nothing and returns nothing for an empty list", async () => {
    expect(await sendEmailBatch([])).toEqual([]);
    expect(batchSend).not.toHaveBeenCalled();
  });

  it("chunks at the batch ceiling instead of one request per email", async () => {
    batchSend.mockImplementation(async (payload: unknown[]) => ({
      data: { data: payload.map((_, i) => ({ id: `id-${i}` })), errors: [] },
      error: null,
    }));

    const emails = Array.from({ length: BATCH_MAX + 30 }, (_, i) => mail(`u${i}@x.com`));
    const results = await sendEmailBatch(emails);

    expect(batchSend).toHaveBeenCalledTimes(2);
    expect(batchSend.mock.calls[0][0]).toHaveLength(BATCH_MAX);
    expect(batchSend.mock.calls[1][0]).toHaveLength(30);
    expect(results).toHaveLength(BATCH_MAX + 30);
    expect(results.every((r) => r.error === null && r.id)).toBe(true);
  });

  it("requests permissive validation so one bad address cannot sink the chunk", async () => {
    batchSend.mockResolvedValue({ data: { data: [{ id: "a" }], errors: [] }, error: null });
    await sendEmailBatch([mail("a@x.com")]);
    expect(batchSend.mock.calls[0][1]).toMatchObject({ batchValidation: "permissive" });
  });

  it("maps per-index failures back to the right recipients", async () => {
    batchSend.mockResolvedValue({
      data: {
        data: [{ id: "ok-0" }, { id: "" }, { id: "ok-2" }],
        errors: [{ index: 1, message: "invalid_to" }],
      },
      error: null,
    });

    const results = await sendEmailBatch([mail("a@x.com"), mail("bad"), mail("c@x.com")]);
    expect(results[0]).toEqual({ to: "a@x.com", id: "ok-0", error: null });
    expect(results[1]).toEqual({ to: "bad", id: null, error: "invalid_to" });
    expect(results[2]).toEqual({ to: "c@x.com", id: "ok-2", error: null });
  });

  it("uses a distinct idempotency key per chunk", async () => {
    batchSend.mockImplementation(async (payload: unknown[]) => ({
      data: { data: payload.map(() => ({ id: "x" })), errors: [] },
      error: null,
    }));

    const emails = Array.from({ length: BATCH_MAX + 1 }, (_, i) => mail(`u${i}@x.com`));
    await sendEmailBatch(emails, { idempotencyKeyPrefix: "feedback-2026-08" });

    const keys = batchSend.mock.calls.map((c) => (c[1] as { idempotencyKey: string }).idempotencyKey);
    // A single key across chunks would make chunk 2 a replay of chunk 1.
    expect(new Set(keys).size).toBe(2);
    for (const k of keys) expect(k.length).toBeLessThanOrEqual(256);
  });

  it("gives a targeted top-up a different key than the full wave", async () => {
    batchSend.mockImplementation(async (payload: unknown[]) => ({
      data: { data: payload.map(() => ({ id: "x" })), errors: [] },
      error: null,
    }));

    await sendEmailBatch(
      [mail("a@x.com"), mail("b@x.com"), mail("c@x.com")],
      { idempotencyKeyPrefix: "wave" }
    );
    await sendEmailBatch([mail("late-signup@x.com")], { idempotencyKeyPrefix: "wave" });

    const keys = batchSend.mock.calls.map(
      (c) => (c[1] as { idempotencyKey: string }).idempotencyKey
    );
    // Same campaign, different recipients: the keys must differ, otherwise
    // Resend 409s the top-up as a payload mismatch inside the 24h window.
    expect(new Set(keys).size).toBe(2);
  });

  it("keys a retry of the same recipients identically regardless of input order", async () => {
    batchSend.mockImplementation(async (payload: unknown[]) => ({
      data: { data: payload.map(() => ({ id: "x" })), errors: [] },
      error: null,
    }));

    await sendEmailBatch([mail("b@x.com"), mail("a@x.com")], { idempotencyKeyPrefix: "wave" });
    await sendEmailBatch([mail("a@x.com"), mail("b@x.com")], { idempotencyKeyPrefix: "wave" });

    const keys = batchSend.mock.calls.map(
      (c) => (c[1] as { idempotencyKey: string }).idempotencyKey
    );
    // Clerk enumeration order is not stable across retries; the key must be,
    // or a retried wave would double-send instead of deduping.
    expect(keys[0]).toBe(keys[1]);
  });

  it("marks the whole chunk failed on an API-level error", async () => {
    batchSend.mockResolvedValue({ data: null, error: { message: "rate_limit_exceeded" } });
    const results = await sendEmailBatch([mail("a@x.com"), mail("b@x.com")]);
    expect(results.map((r) => r.error)).toEqual(["rate_limit_exceeded", "rate_limit_exceeded"]);
  });

  it("survives the SDK throwing on a network failure", async () => {
    batchSend.mockRejectedValue(new Error("fetch failed"));
    const results = await sendEmailBatch([mail("a@x.com")]);
    expect(results).toEqual([{ to: "a@x.com", id: null, error: "fetch failed" }]);
  });

  it("reports every recipient when the API key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const results = await sendEmailBatch([mail("a@x.com")]);
    expect(results[0].error).toBe("resend_not_configured");
    expect(batchSend).not.toHaveBeenCalled();
  });
});
