/**
 * Cloud auth (Clerk) is behind a build-time flag while the hosted app is still
 * being built. With it OFF (the default), the whole site renders with no Clerk
 * dependency — no publishable/secret keys required — and `/app` and `/cloud`
 * degrade to public shells. The marketing homepage is unaffected either way.
 *
 * Turn it on later by setting `NEXT_PUBLIC_CLERK_ENABLED=true` at build time and
 * providing the Clerk keys (publishable key at build, secret key as a Worker
 * secret). Until then the flag keeps production up without them.
 */
export const CLERK_ENABLED = process.env.NEXT_PUBLIC_CLERK_ENABLED === "true";
