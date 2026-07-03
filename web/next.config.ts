import type { NextConfig } from "next";

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

export default nextConfig;
