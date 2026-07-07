import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { StudioEditor } from "@/components/app/studio-editor";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manga Studio — create your own manga with AI",
  description:
    "Draw or generate every panel of your own manga chapter. AI augments your art — enhance a rough sketch into your style, suggest scenes and dialogue — you stay the author. Free to try, no account needed.",
  alternates: { canonical: `${SITE_URL}/studio` },
};

export default async function StudioPage() {
  // Resolve sign-in on the server so the editor never mistakes a logged-in
  // creator for a guest (the client list-fetch only confirms it afterward).
  const signedIn = DEV_NO_CLERK ? true : !!(await currentUser());

  return (
    <main id="main" className="mx-auto mt-6 w-full max-w-[1400px] px-4 md:mt-8 md:px-6">
      <StudioEditor signedIn={signedIn} />
    </main>
  );
}
