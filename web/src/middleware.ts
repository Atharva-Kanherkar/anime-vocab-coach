import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  enPathToJa,
  resolveSiteLocale,
} from "@/lib/locale";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// Anonymous product-funnel beacons (always 204, no auth). Exempt before Clerk
// so a Clerk outage / CPU spike cannot 5xx them. Named because
// middleware-matcher.test.ts pins these route lists from source.
const BEACON_ROUTES = ["/api/extension/track", "/api/ending/track"];
const isBeaconRoute = createRouteMatcher(BEACON_ROUTES);

// Routes where clerkMiddleware must run: everything that calls auth() /
// currentUser() on the server, plus the auth pages and the Clerk proxy.
const CLERK_ROUTES = [
  "/app(.*)",
  "/studio",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(api|trpc)(.*)",
  "/__clerk(.*)",
];
const needsClerk = createRouteMatcher(CLERK_ROUTES);

function currentLocale(req: NextRequest) {
  return resolveSiteLocale({
    cookie: req.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: req.headers.get("accept-language"),
    langParam: req.nextUrl.searchParams.get("lang"),
  });
}

// One-directional on purpose: ja-locale visitors on a mapped EN page get sent
// to the /ja mirror, but nothing EVER redirects off an explicitly requested
// /ja path — crawlers send no Accept-Language and no cookies, so a ja→en
// redirect would 307 the entire live /ja cluster out of the index (and bounce
// EN-browser humans who follow a shared /ja link). Leaving /ja means clicking
// the language switcher (cookie-first) or just navigating away.
function localeRedirect(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;
  const jaTarget = enPathToJa(pathname);
  if (!jaTarget || pathname === jaTarget) return null;
  if (currentLocale(req) !== "ja") return null;

  const url = req.nextUrl.clone();
  url.pathname = jaTarget;
  const res = NextResponse.redirect(url);
  res.cookies.set(LOCALE_COOKIE, "ja", { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });
  return res;
}

// Only stamp the cookie on an explicit ?lang= switch. Stamping on every
// cookieless request would add Set-Cookie to all marketing/crawler/beacon
// responses, defeating edge caching — the same per-request-cost class of
// regression as the Clerk 1102 "exceeded resource limits" incidents.
function stampLocaleCookie(req: NextRequest, res: NextResponse): NextResponse {
  const langParam = req.nextUrl.searchParams.get("lang");
  if (langParam === "ja" || langParam === "en") {
    res.cookies.set(LOCALE_COOKIE, langParam, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
    });
  }
  return res;
}

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const host = req.headers.get("host");
  if (host === "www.animevocab.com") {
    const url = new URL(req.url);
    url.host = "animevocab.com";
    return NextResponse.redirect(url, 301);
  }

  // Anonymous product-funnel beacons (always 204, no auth): exempt before
  // Clerk AND before locale work so nothing can slow or 5xx them.
  if (isBeaconRoute(req)) return NextResponse.next();

  const redirect = localeRedirect(req);
  if (redirect) return redirect;

  if (DEV_NO_CLERK || !needsClerk(req)) {
    return stampLocaleCookie(req, NextResponse.next());
  }

  return clerkMiddleware(
    async (auth, request) => {
      if (isProtectedRoute(request)) await auth.protect();
    },
    { frontendApiProxy: { enabled: true } }
  )(req, event);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
