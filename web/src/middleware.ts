import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
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
    "/app(.*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
