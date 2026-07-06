import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { GITHUB_URL } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ThemeToggle } from "@/components/app/theme-toggle";

// Bordered riso navbar for /app subpages (e.g. notebook detail). The main
// /app page renders its own navbar inside AppShell.
export function AppNav() {
  return (
    <div className="mx-auto max-w-[960px] px-5 md:px-8">
      <header className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-2 border-ink bg-panel px-4 py-3 md:px-5">
        <Link href="/" className="flex items-center gap-3 font-jpround text-[16px] font-bold" aria-label="AnimeVocab home">
          <span className="av-hanko" aria-hidden>アニ</span>
          アニメVocab
        </Link>
        <nav aria-label="App" className="ml-auto flex items-center gap-1">
          <Link
            href="/app"
            className="whitespace-nowrap border-2 border-ink bg-ink px-3 py-1.5 text-[13px] font-extrabold text-bg"
          >
            Back to app
          </Link>
          <a
            href={GITHUB_URL}
            rel="noopener noreferrer"
            className="hidden whitespace-nowrap px-3 py-1.5 text-[13px] font-extrabold text-ink2 hover:text-ink sm:block"
          >
            Extension
          </a>
        </nav>
        <span className="flex items-center gap-2">
          <ThemeToggle />
          {!DEV_NO_CLERK && <UserButton />}
        </span>
      </header>
    </div>
  );
}
