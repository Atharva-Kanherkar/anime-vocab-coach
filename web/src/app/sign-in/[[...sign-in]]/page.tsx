import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    // A landmark and a page heading for screen readers: Clerk's card has a
    // visual title but no h1, and the page had no <main> for the skip link.
    <main id="main" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <h1 className="sr-only">Sign in to AnimeVocab</h1>
      {DEV_NO_CLERK ? (
        <p style={{ color: "#eef2fc" }}>
          Clerk is bypassed in dev. Go to <a href="/app" style={{ color: "#e3ba63" }}>/app</a>.
        </p>
      ) : (
        <SignIn />
      )}
    </main>
  );
}
