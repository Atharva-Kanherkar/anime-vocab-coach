import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { GITHUB_URL } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export function AppTopNav() {
  return (
    <header className="app-top">
      <Link className="logo" href="/" aria-label="AnimeVocab home">
        アニメ<b>Vocab</b>
      </Link>
      <nav aria-label="App">
        <Link href="/">Home</Link>
        <Link href="/cloud">Cloud</Link>
        <Link href="/#pricing">Pricing</Link>
        <a href={GITHUB_URL} rel="noopener noreferrer">
          Install
        </a>
      </nav>
      {!DEV_NO_CLERK && <UserButton />}
    </header>
  );
}
