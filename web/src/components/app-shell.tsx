import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { installUrl } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export function AppTopNav() {
  return (
    <header className="app-top">
      <Link className="logo" href="/" aria-label="AnimeVocab home">
        アニメ<b>Vocab</b>
      </Link>
      <nav aria-label="App">
        <Link href="/app">Dashboard</Link>
        <a href={installUrl()} rel="noopener noreferrer">
          Extension
        </a>
      </nav>
      {!DEV_NO_CLERK && <UserButton />}
    </header>
  );
}
