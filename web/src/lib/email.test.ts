import { describe, expect, it } from "vitest";
import { escapeHtml, maxGiftEmailCopy } from "./email";

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
