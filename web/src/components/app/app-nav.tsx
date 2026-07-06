import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { GITHUB_URL } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ThemeToggle } from "@/components/app/theme-toggle";

// Themed top bar for the cloud app. Glassy, sticky, and theme-reactive — the
// marketing nav (site-chrome) is untouched.
export function AppNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex w-[min(880px,calc(100%-40px))] items-center gap-4 py-3.5">
        <Link href="/" className="font-jp text-[17px] text-ink" aria-label="AnimeVocab home">
          アニメ<b className="font-semibold text-accent">Vocab</b>
        </Link>
        <nav aria-label="App" className="ml-auto flex items-center gap-1.5">
          <a
            href={GITHUB_URL}
            rel="noopener noreferrer"
            className="av-btn av-btn-ghost av-btn-sm hidden sm:inline-flex"
          >
            Get the extension
          </a>
          <ThemeToggle />
          {!DEV_NO_CLERK && (
            <span className="ml-1 inline-flex items-center">
              <UserButton />
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
