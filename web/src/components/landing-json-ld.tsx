import { articleJsonLd } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export function LandingJsonLd({
  path,
  title,
  description,
  publishedAt = "2026-07-08T00:00:00.000Z",
}: {
  path: string;
  title: string;
  description: string;
  publishedAt?: string;
}) {
  const jsonLd = articleJsonLd({
    title,
    description,
    url: `${SITE_URL}${path}`,
    publishedAt,
    updatedAt: publishedAt,
  });

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
