import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const header = (name: string, dev = false) => securityHeaders({ dev }).find((h) => h.key === name)?.value;
const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(name + " "))?.slice(name.length + 1).split(" ") ?? [];

describe("security headers (ISO 25010 security audit)", () => {
  it("sends the full set on every response", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ])
    );
    expect(header("Strict-Transport-Security")).toMatch(/max-age=63072000; includeSubDomains/);
    expect(header("X-Frame-Options")).toBe("DENY");
  });

  it("forbids framing, plugins and base-tag hijacking", () => {
    const csp = contentSecurityPolicy();
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
  });

  it("never allows eval or a wildcard source in production", () => {
    const csp = contentSecurityPolicy();
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toMatch(/(^|\s)(\*|https:|http:)(\s|;|$)/);
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("allows eval only for the dev server's Fast Refresh", () => {
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("limits where an injected script could send data", () => {
    expect(directive(contentSecurityPolicy(), "connect-src")).toEqual([
      "'self'",
      "https://api.animevocab.com",
      "https://cloudflareinsights.com",
      "https://www.facebook.com",
    ]);
  });
});
