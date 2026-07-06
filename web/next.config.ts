import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/privacy.html", destination: "/privacy", permanent: true },
      {
        source: "/learn-japanese-with-anime.html",
        destination: "/learn-japanese-with-anime",
        permanent: true,
      },
      {
        source: "/vs-language-reactor.html",
        destination: "/vs-language-reactor",
        permanent: true,
      },
      { source: "/vs-migaku.html", destination: "/vs-migaku", permanent: true },
    ];
  },
};

const config = (phase: string) => {
  // Hard stop: the dev Clerk bypass must never be inlined into a production
  // build. It's only ever needed under `next dev`. Throwing here turns the
  // "dev flag + overridden NODE_ENV" accident into an impossible build state.
  if (phase === PHASE_PRODUCTION_BUILD && process.env.NEXT_PUBLIC_AVC_DEV_NO_CLERK === "1") {
    throw new Error(
      "NEXT_PUBLIC_AVC_DEV_NO_CLERK=1 is set during a production build. This dev-only " +
        "auth bypass must never ship. Unset it before building/deploying."
    );
  }

  // Hard stop: the publishable key (browser) and secret key (middleware) MUST
  // belong to the same Clerk instance. A test/live mismatch means the browser
  // mints a session on one instance while the server validates it against the
  // other — so every signed-in request reads as signed-out and /app 404s after
  // login. This silently broke prod once (pk_test dev key + sk_live prod key);
  // fail the build instead of shipping broken auth. Only checked when both keys
  // are present (they are in CI/deploy; absent in a local no-Clerk build).
  if (phase === PHASE_PRODUCTION_BUILD) {
    const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const sk = process.env.CLERK_SECRET_KEY;
    const pkEnv = pk?.startsWith("pk_live_") ? "live" : pk?.startsWith("pk_test_") ? "test" : null;
    const skEnv = sk?.startsWith("sk_live_") ? "live" : sk?.startsWith("sk_test_") ? "test" : null;
    if (pkEnv && skEnv && pkEnv !== skEnv) {
      throw new Error(
        `Clerk key mismatch: publishable key is a ${pkEnv} key but secret key is a ${skEnv} key. ` +
          "Both must come from the same Clerk instance (both pk_live_/sk_live_, or both " +
          "pk_test_/sk_test_). Fix NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY."
      );
    }
  }

  return nextConfig;
};

export default config;
