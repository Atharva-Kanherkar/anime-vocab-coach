"use client";

import { useEffect } from "react";
import { EndingPicker } from "@/components/app/ending-picker";
import { trackMeta } from "@/lib/meta-pixel";
import type { FeaturedEndingManga } from "@/lib/ending-hooks";

export function EndingPageClient({ manga }: { manga: FeaturedEndingManga }) {
  useEffect(() => {
    trackMeta("ViewContent", {
      content_name: "ending_picker",
      content_ids: manga.id,
    });
  }, [manga.id]);

  return <EndingPicker manga={manga} />;
}
