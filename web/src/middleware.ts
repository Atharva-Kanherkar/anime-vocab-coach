import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

// Routes where clerkMiddleware must run: everything that calls auth() /
// currentUser() on the server, plus the auth pages and the Clerk proxy.
// Keep this list tight — running Clerk on every marketing page multiplied
// per-request CPU ~5x and caused intermittent 1102 "exceeded resource
// limits" errors under traffic bursts. Static pages skip Clerk entirely.
const CLERK_ROUTES = [
  "/app(.*)",
  "/studio", // public page, but reads signed-in state via currentUser()
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/(api|trpc)(.*)",
  "/__clerk(.*)",
];
const needsClerk = createRouteMatcher(CLERK_ROUTES);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Canonical host: www has a proxied DNS record; the Worker answers it and
  // redirects here (www previously 522ed with nothing bound to it).
  const host = req.headers.get("host");
  if (host === "www.animevocab.com") {
    const url = new URL(req.url);
    url.host = "animevocab.com";
    return NextResponse.redirect(url, 301);
  }

  // Local dev without Clerk keys: let every request through untouched.
  if (DEV_NO_CLERK) return NextResponse.next();

  // Marketing/static pages: no server-side auth — skip Clerk's per-request
  // work. Clerk client components (sign-in buttons) still function; they
  // talk to the /__clerk proxy, which is matched above.
  if (!needsClerk(req)) return NextResponse.next();

  return clerkMiddleware(
    async (auth, request) => {
      if (isProtectedRoute(request)) await auth.protect();
    },
    {
      frontendApiProxy: {
        enabled: true,
      },
    }
  )(req, event);
}

export const config = {
  // Broad on purpose: the www→apex redirect must see every path. Anything
  // not in CLERK_ROUTES exits via the cheap NextResponse.next() above.
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
