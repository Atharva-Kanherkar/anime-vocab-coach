import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { CLERK_ENABLED } from "@/lib/flags";

const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  // Clerk off (default): pass everything through so no keys are needed and no
  // route 500s. Turn on via NEXT_PUBLIC_CLERK_ENABLED=true. See @/lib/flags.
  if (!CLERK_ENABLED) return NextResponse.next();

  return clerkMiddleware(async (auth, request) => {
    if (isProtectedRoute(request)) await auth.protect();
  })(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
