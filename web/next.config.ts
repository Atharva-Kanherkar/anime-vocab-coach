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
  return nextConfig;
};

export default config;
