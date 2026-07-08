"use client";

// Slim top bar for the public Studio + Gallery pages (outside the /app shell).
// Home / Studio / Gallery links, theme toggle, and a sign-in affordance.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { DEV_NO_CLERK } from "@/lib/dev-auth";
import { ThemeToggle } from "@/components/app/theme-toggle";

// Split out so the useUser hook only runs when ClerkProvider is mounted
// (it isn't under the local DEV_NO_CLERK bypass).
function ClerkAuthButtons() {
  const { isSignedIn } = useUser();
  return isSignedIn ? (
    <UserButton />
  ) : (
    <Link
      href="/sign-in"
      className="border-2 border-line px-3 py-1.5 text-[13px] font-extrabold text-ink2 hover:text-ink"
    >
      Sign in
    </Link>
  );
}

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/gallery", label: "Gallery" },
  { href: "/ai-manga-maker", label: "AI manga maker" },
  { href: "/blog", label: "Blog" },
  { href: "/learn-japanese-with-anime", label: "Guides" },
];

export function StudioChrome() {
  const pathname = usePathname();
  return (
    <header className="mx-auto mt-6 flex max-w-[960px] flex-wrap items-center gap-x-5 gap-y-3 border-2 border-ink bg-panel px-4 py-3 md:px-5">
      <Link href="/" className="flex items-center gap-3 font-jpround text-[16px] font-bold" aria-label="AnimeVocab home">
        <span className="av-hanko" aria-hidden>アニ</span>
        アニメVocab
      </Link>

      <nav aria-label="Studio" className="order-3 -mx-1 flex w-full gap-1 md:order-none md:mx-0 md:ml-auto md:w-auto">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                "whitespace-nowrap border-2 px-3 py-1.5 text-[13px] font-extrabold transition " +
                (active ? "border-ink bg-ink text-bg" : "border-transparent text-ink2 hover:text-ink")
              }
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <span className="ml-auto flex items-center gap-2 md:ml-0">
        <ThemeToggle />
        {!DEV_NO_CLERK && <ClerkAuthButtons />}
      </span>
    </header>
  );
}
