"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useSiteLocale } from "@/components/locale-provider";
import { GITHUB_URL, installUrl } from "@/lib/site";
import { DEV_NO_CLERK } from "@/lib/dev-auth";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  const { t } = useSiteLocale();

  return (
    <header className="top">
      <div className="wrap top-inner">
        <Link className="logo" href="/" aria-label="AnimeVocab home">
          アニメ<b>Vocab</b>
        </Link>
        {compact ? (
          <nav aria-label="Primary" className="top-nav-compact">
            <Link href="/blog">{t("blog")}</Link>
            <Link href="/end">{t("endings")}</Link>
            <Link href="/studio">{t("studio")}</Link>
            <Link href="/gallery">{t("gallery")}</Link>
            <Link href="/learn-japanese-with-anime">{t("guides")}</Link>
          </nav>
        ) : (
          <nav aria-label="Primary">
            <Link href="/#features">{t("features")}</Link>
            <Link href="/studio">{t("studio")}</Link>
            <Link href="/gallery">{t("gallery")}</Link>
            <Link href="/cloud">{t("cloud")}</Link>
            <Link href="/#pricing">{t("pricing")}</Link>
            <Link href="/#faq">{t("faq")}</Link>
          </nav>
        )}
        <LanguageSwitcher compact />
        <AuthControls size="sm" />
        <a className="btn btn-sm btn-line" href={installUrl()} rel="noopener noreferrer">
          {t("installFree")}
        </a>
      </div>
    </header>
  );
}

export function HomeNav() {
  const { t } = useSiteLocale();

  return (
    <header className="floatnav">
      <Link className="floatnav__logo" href="/" aria-label="AnimeVocab home">
        アニメ<b>Vocab</b>
      </Link>
      <div className="floatnav__right">
        <Link href="/cloud" prefetch={false}>
          {t("cloud")}
        </Link>
        <LanguageSwitcher compact />
        <AuthControls size="sm" />
      </div>
    </header>
  );
}

export function AuthControls({ size = "md" }: { size?: "sm" | "md" }) {
  const { t } = useSiteLocale();
  const lineClass = size === "sm" ? "btn btn-sm btn-line" : "btn btn-line";
  const accentClass = size === "sm" ? "btn btn-sm btn-accent" : "btn btn-accent";

  if (DEV_NO_CLERK) {
    return (
      <Link className={lineClass} href="/app" prefetch={false}>
        {t("cloudApp")}
      </Link>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <button className={accentClass} type="button">
            {t("signUp")}
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button className={lineClass} type="button">
            {t("signIn")}
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link className={lineClass} href="/app" prefetch={false}>
          {t("cloudApp")}
        </Link>
        <UserButton />
      </Show>
    </>
  );
}

export function HomeBrandBar() {
  const { t } = useSiteLocale();
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
      <div className="home-bar__actions">
        <LanguageSwitcher compact />
        <a className="btn btn-sm btn-accent" href={installUrl()} rel="noopener noreferrer">
          {t("addToChrome")}
        </a>
      </div>
    </header>
  );
}

export function SiteFooter({ links }: { links?: { href: string; label: string }[] }) {
  const { t } = useSiteLocale();
  const defaultLinks = [
    { href: "/anime-vocabulary", label: "Anime vocabulary" },
    { href: "/studio", label: t("studio") },
    { href: "/gallery", label: t("gallery") },
    { href: "/blog", label: t("blog") },
    { href: "/learn-japanese-with-anime", label: t("guides") },
    { href: "/ja", label: t("languageJa") },
    { href: GITHUB_URL, label: "GitHub" },
    { href: "/privacy", label: "Privacy" },
    { href: "/without-extension", label: "No extension?" },
  ];

  return (
    <footer className="foot">
      <div className="wrap foot-inner">
        <span>{t("footerTagline")}</span>
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
