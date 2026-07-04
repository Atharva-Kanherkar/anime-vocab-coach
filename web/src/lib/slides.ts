import { GITHUB_URL } from "@/lib/site";

export type HeroSlide = {
  id: string;
  /** Special slide body rendered by FxSlider ("pricing" | "faq"). */
  kind?: "pricing" | "faq";
  /** Bright artwork — FxSlider adds a deeper scrim so light text stays readable. */
  bright?: boolean;
  /** Cinematic CSS-gradient backdrop. Used when no `image` is set. */
  tone: string;
  /** Optional real art — overrides `tone` when present. */
  image?: string;
  thumb?: string;
  /** Short label for the left scroll index. */
  navLabel: string;
  /** Short label for the right scroll index. */
  tag: string;
  kicker: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

/**
 * Copy stays in narrative order; the background images are shuffled so the
 * strongest art leads (starry night first, then blossoms). `image` overrides
 * the `tone` gradient fallback.
 */
export const heroSlides: HeroSlide[] = [
  {
    id: "watch",
    tone: "radial-gradient(120% 120% at 78% 12%, rgba(224,120,86,0.55), transparent 46%), radial-gradient(90% 90% at 12% 92%, rgba(78,56,120,0.6), transparent 55%), linear-gradient(158deg, #241a2b 0%, #14101a 55%, #0b0910 100%)",
    image: "/slides/05-private.jpg",
    navLabel: "Immersion",
    tag: "Watch & learn",
    kicker: "01 · immersion",
    title: "Learn Japanese from the anime you already watch.",
    body: "One useful word per line, in romaji, with the meaning and the exact moment it was spoken.",
    ctaLabel: "Add to Chrome",
    ctaHref: GITHUB_URL,
    secondaryLabel: "How it works",
    secondaryHref: "#how",
  },
  {
    id: "listen",
    tone: "radial-gradient(100% 90% at 85% 18%, rgba(214,86,142,0.5), transparent 50%), radial-gradient(90% 85% at 8% 82%, rgba(42,112,152,0.48), transparent 55%), linear-gradient(158deg, #111827 0%, #0d1018 60%, #08070d 100%)",
    image: "/slides/04-fireflies.jpg",
    navLabel: "Any platform",
    tag: "Netflix · Crunchyroll",
    kicker: "02 · any platform",
    title: "Works when there are no Japanese subtitles.",
    body: "Listening Mode transcribes audio on Netflix, Crunchyroll, and YouTube while English subs stay on.",
    ctaLabel: "See pricing",
    ctaHref: "#slide-pricing",
  },
  {
    id: "mist",
    tone: "radial-gradient(110% 90% at 28% 14%, rgba(126,146,196,0.42), transparent 55%), radial-gradient(92% 90% at 82% 96%, rgba(96,72,138,0.44), transparent 55%), linear-gradient(158deg, #1a1e29 0%, #12131c 60%, #0a0a10 100%)",
    image: "/slides/03-wisteria.jpg",
    navLabel: "Beginners",
    tag: "Romaji-first",
    kicker: "03 · beginners",
    title: "Romaji first. Kana when you are ready.",
    body: "Cards lead with taikutsu, not 退屈. You can start on episode one without reading hiragana.",
    ctaLabel: "Install free",
    ctaHref: GITHUB_URL,
  },
  {
    id: "sakura",
    tone: "radial-gradient(112% 100% at 74% 16%, rgba(216,120,152,0.52), transparent 50%), radial-gradient(90% 90% at 10% 90%, rgba(124,62,112,0.46), transparent 55%), linear-gradient(158deg, #251a24 0%, #17111a 60%, #0c0910 100%)",
    image: "/slides/04-sakura-night.jpg",
    navLabel: "Memory",
    tag: "Spaced repetition",
    kicker: "04 · memory",
    title: "Reviews find you in the next episode.",
    body: "Spaced repetition resurfaces words right before you would forget them. No Anki session required.",
    ctaLabel: "Compare tools",
    ctaHref: "/learn-japanese-with-anime",
  },
  {
    id: "night",
    tone: "radial-gradient(112% 100% at 82% 84%, rgba(224,120,86,0.34), transparent 50%), radial-gradient(82% 80% at 18% 12%, rgba(64,74,136,0.5), transparent 55%), linear-gradient(158deg, #0f1320 0%, #0a0b14 60%, #07060c 100%)",
    image: "/slides/05-torii-night.jpg",
    navLabel: "Private",
    tag: "Local · open source",
    kicker: "05 · private",
    title: "Your progress stays on your device.",
    body: "No account, no analytics, no selling data. Open source under AGPL on GitHub.",
    ctaLabel: "View on GitHub",
    ctaHref: GITHUB_URL,
  },
  {
    id: "manifesto",
    tone: "linear-gradient(158deg, #10141f 0%, #0a0d16 60%, #07060c 100%)",
    image: "/slides/06-manifesto.jpg",
    navLabel: "Real shows",
    tag: "Real shows",
    kicker: "06 · why",
    title: "Vocabulary from real shows, not textbook dialogues.",
    body: "Without opening Anki mid-episode. One word at a time, in context, with scheduled reviews.",
  },
  {
    id: "pricing",
    kind: "pricing",
    tone: "linear-gradient(158deg, #131020 0%, #0c0a14 60%, #07060c 100%)",
    image: "/slides/07-pricing.jpg",
    navLabel: "Pricing",
    tag: "Free · Pro",
    kicker: "07 · pricing",
    title: "The core loop is free forever.",
    body: "Pro pays for transcription compute.",
  },
  {
    id: "begin",
    bright: true,
    tone: "linear-gradient(158deg, #1a1420 0%, #0f0a12 60%, #07060c 100%)",
    image: "/slides/08-final.jpg",
    navLabel: "Begin",
    tag: "始めよう",
    kicker: "08 · begin",
    title: "Your next episode can teach you a word.",
    body: "次のエピソードから、始めよう。",
    ctaLabel: "Add to Chrome — free",
    ctaHref: GITHUB_URL,
  },
  {
    id: "faq",
    kind: "faq",
    image: "/slides/09-faq.jpg",
    tone: "radial-gradient(110% 90% at 50% 0%, rgba(64, 74, 136, 0.35), transparent 55%), linear-gradient(158deg, #0f1320 0%, #0a0b14 60%, #07060c 100%)",
    navLabel: "FAQ",
    tag: "FAQ",
    kicker: "09 · faq",
    title: "FAQ",
    body: "",
  },
];
