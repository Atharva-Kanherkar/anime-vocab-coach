// Response headers every page and route on animevocab.com carries (ISO 25010
// security audit, 2026-10). Before this the site sent none: no CSP, no HSTS,
// nothing stopping it being framed.
//
// The CSP allowlist is what the live site was observed to load (Playwright
// request log over the public pages and the Clerk sign-in / sign-up flow, with
// this policy injected into production responses: zero violations), plus the
// two integrations that only load on demand: the Meta Pixel (when
// NEXT_PUBLIC_META_PIXEL_ID is set) and Cloudflare Turnstile (Clerk's bot
// check on sign-up). Clerk's frontend API and clerk-js come through the
// same-origin /__clerk proxy, so they need no entry. Adding a third party means
// adding it here; security-headers.test.ts pins the policy.
//
// script-src keeps 'unsafe-inline': the App Router inlines its flight data and
// the pages are prerendered and edge-cached, so per-request nonces would turn
// every cached page dynamic. The host allowlist, connect-src and the framing,
// base-uri, object and form rules still bound what an injected script can load,
// where it can send data, and who can frame the site.

const SCRIPT_HOSTS = [
  "https://static.cloudflareinsights.com",
  "https://connect.facebook.net",
  "https://challenges.cloudflare.com",
];

const CONNECT_HOSTS = [
  "https://api.animevocab.com",
  "https://cloudflareinsights.com",
  "https://www.facebook.com",
];

const IMG_HOSTS = ["https://img.clerk.com", "https://www.facebook.com"];

export function contentSecurityPolicy({ dev = false }: { dev?: boolean } = {}): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // React's dev overlay and Fast Refresh need eval; production never does.
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...SCRIPT_HOSTS],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...IMG_HOSTS],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "data:", "blob:"],
    "connect-src": ["'self'", ...CONNECT_HOSTS, ...(dev ? ["ws:"] : [])],
    "frame-src": ["'self'", "https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Checkout is a link today; listed so a form-driven redirect to it later
    // is not silently blocked (Chrome applies form-action to redirects).
    "form-action": ["'self'", "https://checkout.dodopayments.com"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders({ dev = false }: { dev?: boolean } = {}): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    // Two years, subdomains included (api., www., the Clerk hosts are all
    // HTTPS on Cloudflare). Not "preload": that is a one-way submission and
    // should be a deliberate decision, not a side effect of this header.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Legacy twin of frame-ancestors for browsers that predate CSP2.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  ];
}
