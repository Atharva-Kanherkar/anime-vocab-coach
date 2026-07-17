import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  enPathToJa,
  isJaPath,
  jaPathToEn,
  resolveSiteLocale,
} from "@/lib/locale";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);
const isBeaconRoute = createRouteMatcher(["/api/extension/track", "/api/ending/track"]);
const needsClerk = createRouteMatcher([
  "/app(.*)",
  "/studio",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(api|trpc)(.*)",
  "/__clerk(.*)",
]);

function currentLocale(req: NextRequest) {
  return resolveSiteLocale({
    cookie: req.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: req.headers.get("accept-language"),
    langParam: req.nextUrl.searchParams.get("lang"),
  });
}

function localeRedirect(req: NextRequest): NextResponse | null {
  const pathname = req.nextUrl.pathname;
  const locale = currentLocale(req);
  const jaTarget = enPathToJa(pathname);
  const enTarget = jaPathToEn(pathname);

  if (locale === "ja" && jaTarget && pathname !== jaTarget) {
    const url = req.nextUrl.clone();
    url.pathname = jaTarget;
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, "ja", { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });
    return res;
  }

  if (locale === "en" && isJaPath(pathname) && enTarget) {
    const url = req.nextUrl.clone();
    url.pathname = enTarget;
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, "en", { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE });
    return res;
  }

  return null;
}

function stampLocaleCookie(req: NextRequest, res: NextResponse): NextResponse {
  const langParam = req.nextUrl.searchParams.get("lang");
  if (!req.cookies.get(LOCALE_COOKIE) || langParam === "ja" || langParam === "en") {
    res.cookies.set(LOCALE_COOKIE, currentLocale(req), {
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

  const redirect = localeRedirect(req);
  if (redirect) return redirect;

  if (DEV_NO_CLERK || isBeaconRoute(req) || !needsClerk(req)) {
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
