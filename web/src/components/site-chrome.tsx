"use client";

import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState, type CSSProperties } from "react";
import { GITHUB_URL, getPromoState, type PromoState } from "@/lib/site";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="top">
      <div className="wrap top-inner">
        <Link className="logo" href="/" aria-label="AnimeVocab home">
          アニメ<b>Vocab</b>
        </Link>
        {!compact && (
          <nav aria-label="Primary">
            <Link href="/#features">Features</Link>
            <Link href="/cloud">Cloud</Link>
            <Link href="/learn-japanese-with-anime">Compare</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
        )}
        <AuthControls size="sm" />
        <a className="btn btn-sm btn-line" href={GITHUB_URL} rel="noopener noreferrer">
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
      <a className="btn btn-sm btn-accent" href={GITHUB_URL} rel="noopener noreferrer">
        Add to Chrome
      </a>
    </header>
  );
}

export function SiteFooter({ links }: { links?: { href: string; label: string }[] }) {
  const defaultLinks = [
    { href: GITHUB_URL, label: "GitHub" },
    { href: "/privacy", label: "Privacy" },
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

export function PromoBar({ initial }: { initial: PromoState }) {
  const [promo, setPromo] = useState(initial);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!apiBase || apiBase.includes("example.workers.dev")) return;
    fetch(`${apiBase}/v1/public/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.promo) setPromo({ ...getPromoState(), ...data.promo, active: true });
      })
      .catch(() => {});
  }, []);

  if (!promo.active) return null;

  const dayWord = promo.daysLeft === 1 ? "day" : "days";

  return (
    <div className="promo-bar">
      <div className="wrap promo-inner">
        <span className="promo-text">
          Launch pricing: {promo.promoLabel} · {promo.daysLeft} {dayWord} left
        </span>
        <a href="#pricing" className="promo-link">
          See Pro pricing
        </a>
      </div>
    </div>
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

export function PricingSection({ initialPromo }: { initialPromo: PromoState }) {
  const [promo, setPromo] = useState(initialPromo);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!apiBase || apiBase.includes("example.workers.dev")) return;
    fetch(`${apiBase}/v1/public/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.promo) setPromo({ ...getPromoState(), ...data.promo, active: true });
      })
      .catch(() => {});
  }, []);

  return (
    <section
      className="pricing band band--dim"
      id="pricing"
      style={{ "--band-img": "url(/slides/07-pricing.jpg)" } as CSSProperties}
    >
      <div className="wrap">
        <header className="section-head reveal">
          <span className="jp-mark" aria-hidden="true">価格</span>
          <h2>Pricing</h2>
          <p>The core loop is free forever. Pro pays for transcription compute.</p>
        </header>
        <div className="price-grid reveal">
          <div className="price-card">
            <h3>Free</h3>
            <p className="amount">$0</p>
            <ul>
              <li>Word cards + spaced repetition</li>
              <li>YouTube + HTML5 subtitle sites</li>
              <li>Dashboard &amp; JSON export</li>
              <li>Listening Mode with your OpenAI key</li>
            </ul>
            <a className="btn btn-line" href={GITHUB_URL} rel="noopener noreferrer">
              Install
            </a>
          </div>
          <div className="price-card price-card-pro">
            <span className="pro-tag">Pro</span>
            <h3>Listening Mode, no setup</h3>
            <p className="amount-row">
              {promo.active && (
                <span className="strike">{promo.regularLabel}</span>
              )}
              <span className="amount">
                {promo.active ? promo.promoLabel : promo.regularLabel}
              </span>
            </p>
            <ul>
              <li>No OpenAI account or API key</li>
              <li>Netflix, Crunchyroll, every site</li>
              <li>45 hours of listening / month</li>
              <li>Cancel anytime</li>
            </ul>
            <a
              className="btn btn-accent"
              href={promo.checkoutUrl}
              rel="noopener noreferrer"
            >
              {promo.active ? "Get Pro at launch price" : "Get Pro"}
            </a>
            <p className="price-ownership-note">
              Your data stays local and exportable. Pro is optional hosted convenience.
            </p>
            {promo.active && (
              <p className="promo-note">
                Launch pricing ends in {promo.daysLeft} {promo.daysLeft === 1 ? "day" : "days"}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
