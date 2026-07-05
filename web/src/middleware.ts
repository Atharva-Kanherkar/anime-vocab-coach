import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextFetchEvent, type NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
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
