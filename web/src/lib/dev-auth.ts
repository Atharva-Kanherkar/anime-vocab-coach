// Dev-only auth bypass for local testing without Clerk keys. Enabled ONLY when
// running `next dev` (NODE_ENV !== "production") AND NEXT_PUBLIC_AVC_DEV_NO_CLERK=1.
// In any production build this is a hard `false`, so it can never weaken real
// auth. NEXT_PUBLIC_ so the same switch is readable in client components (nav,
// auth buttons) that must also skip Clerk when the provider isn't mounted.
export const DEV_NO_CLERK =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_AVC_DEV_NO_CLERK === "1";

// The stand-in identity used while the bypass is on.
export const DEV_PROFILE = {
  id: "dev-user",
  email: "dev@animevocab.test",
  name: "Dev Learner",
} as const;
