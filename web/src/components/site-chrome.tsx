"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { GITHUB_URL, installUrl } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="top">
      <div className="wrap top-inner">
        <Link className="logo" href="/" aria-label="AnimeVocab home">
          アニメ<b>Vocab</b>
        </Link>
        {compact ? (
          <nav aria-label="Primary" className="top-nav-compact">
            <Link href="/blog">Blog</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/learn-japanese-with-anime">Guides</Link>
          </nav>
        ) : (
          <nav aria-label="Primary">
            <Link href="/#features">Features</Link>
            <Link href="/studio">Studio</Link>
            <Link href="/gallery">Gallery</Link>
            <Link href="/cloud">Cloud</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
        )}
        <AuthControls size="sm" />
        <a className="btn btn-sm btn-line" href={installUrl()} rel="noopener noreferrer">
          Install free
        </a>
      </div>
    </header>
  );
}

export function HomeNav() {
  return (
    <header className="floatnav">
      <Link className="floatnav__logo" href="/" aria-label="AnimeVocab home">
        アニメ<b>Vocab</b>
      </Link>
      <div className="floatnav__right">
        <Link href="/cloud" prefetch={false}>Cloud</Link>
        <AuthControls size="sm" />
      </div>
    </header>
  );
}

export function AuthControls({ size = "md" }: { size?: "sm" | "md" }) {
  const lineClass = size === "sm" ? "btn btn-sm btn-line" : "btn btn-line";
  const accentClass = size === "sm" ? "btn btn-sm btn-accent" : "btn btn-accent";

  // Dev bypass: no ClerkProvider is mounted, so Clerk components would throw.
  // Show a plain link to the app instead.
  if (DEV_NO_CLERK) {
    return (
      <Link className={lineClass} href="/app" prefetch={false}>
        Cloud app
      </Link>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <button className={accentClass} type="button">Sign up</button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button className={lineClass} type="button">Sign in</button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link className={lineClass} href="/app" prefetch={false}>
          Cloud app
        </Link>
        <UserButton />
      </Show>
    </>
  );
}

export function HomeBrandBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`home-bar${scrolled ? " scrolled" : ""}`}>
      <Link className="logo" href="/" aria-label="AnimeVocab home">
        アニメ<b>Vocab</b>
      </Link>
      <a className="btn btn-sm btn-accent" href={installUrl()} rel="noopener noreferrer">
        Add to Chrome
      </a>
    </header>
  );
}

export function SiteFooter({ links }: { links?: { href: string; label: string }[] }) {
  const defaultLinks = [
    { href: "/studio", label: "Manga Studio" },
    { href: "/gallery", label: "Gallery" },
    { href: "/blog", label: "Blog" },
    { href: "/learn-japanese-with-anime", label: "Guides" },
    { href: GITHUB_URL, label: "GitHub" },
    { href: "/privacy", label: "Privacy" },
    { href: "/without-extension", label: "No extension?" },
    { href: "https://github.com/sponsors/Atharva-Kanherkar", label: "Sponsor" },
  ];

  return (
    <footer className="foot">
      <div className="wrap foot-inner">
        <span>© AnimeVocab · learn Japanese from what you watch</span>
        <nav>
          {(links ?? defaultLinks).map((link) =>
            link.href.startsWith("http") ? (
              <a key={link.href} href={link.href} rel="noopener noreferrer">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}

export function ScrollEffects() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    document.querySelectorAll(".top").forEach((nav) => {
      const onScroll = () => nav.classList.toggle("top-scrolled", window.scrollY > 12);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    });

    return () => io.disconnect();
  }, []);

  return null;
}

