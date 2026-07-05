// Dev-only auth bypass for local testing without Clerk keys. Enabled ONLY when
// running `next dev` (NODE_ENV !== "production") AND NEXT_PUBLIC_AVC_DEV_NO_CLERK=1.
// Pass the flag inline (`NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 npm run dev`) — do NOT
// put it in .env.local, or every build/dev server becomes auth-free.
//
// Both terms are static `process.env` reads, so Next inlines them at build time.
// The canonical CI deploy runs with the flag unset and NODE_ENV=production, so
// both are false. As defense-in-depth against a local deploy with an overridden
// NODE_ENV, next.config.ts throws if this flag is set during a production build.
// NEXT_PUBLIC_ so the same switch is readable in client components (nav, auth
// buttons) that must also skip Clerk when the provider isn't mounted.
export const DEV_NO_CLERK =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_AVC_DEV_NO_CLERK === "1";

// The stand-in identity used while the bypass is on.
export const DEV_PROFILE = {
  id: "dev-user",
  email: "dev@animevocab.test",
  name: "Dev Learner",
} as const;
