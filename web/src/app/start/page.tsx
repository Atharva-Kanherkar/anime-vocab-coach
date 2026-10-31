import type { Metadata } from "next";
import { currentUser } from "@clerk/nextjs/server";
import { DEV_NO_CLERK, DEV_PROFILE } from "@/lib/dev-auth";
import { StartClient } from "./start-client";
import styles from "./start.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start learning with anime",
  description:
    "Create a free AnimeVocab account and connect the extension. Your words, reviews and progress stay with you on every device.",
  robots: { index: false, follow: true },
};

export default async function StartPage() {
  const user = DEV_NO_CLERK ? null : await currentUser();
  const signedIn = DEV_NO_CLERK || !!user;
  const name = DEV_NO_CLERK
    ? DEV_PROFILE.name
    : user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress || "there";

  return (
    <main id="main" className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.brand} href="/">
            <span className={styles.hanko} aria-hidden>
              アニ
            </span>
            <span>AnimeVocab</span>
          </a>
          <a className={styles.home} href="/">
            animevocab.com
          </a>
        </header>

        <StartClient signedIn={signedIn} name={name} />
      </div>
    </main>
  );
}
