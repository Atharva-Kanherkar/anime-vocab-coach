import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Canonical host: www has a proxied DNS record but the Worker serves the
  // apex; without this redirect www visitors get a Cloudflare 522.
  const host = req.headers.get("host");
  if (host === "www.animevocab.com") {
    const url = new URL(req.url);
    url.host = "animevocab.com";
    return NextResponse.redirect(url, 301);
  }

  // Local dev without Clerk keys: let every request through untouched.
  if (DEV_NO_CLERK) return NextResponse.next();

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
  matcher: [
    // All pages except Next internals and static files. Public pages like
    // /studio call currentUser(), which throws (500) on any route the
    // clerkMiddleware didn't run on — so it must cover every page route.
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
