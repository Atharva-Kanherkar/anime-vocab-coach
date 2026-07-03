import { GITHUB_URL } from "@/lib/site";

export type HeroSlide = {
  id: string;
  image: string;
  thumb: string;
  kicker: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

/** Placeholder slides — swap images in public/slides/ when you have finals. */
export const heroSlides: HeroSlide[] = [
  {
    id: "watch",
    image: "/slides/01-dusk.jpg",
    thumb: "/slides/01-dusk.jpg",
    kicker: "Slide 01 · immersion",
    title: "Learn Japanese from the anime you already watch.",
    body: "One useful word per line, in romaji, with the meaning and the exact moment it was spoken.",
    ctaLabel: "Add to Chrome",
    ctaHref: GITHUB_URL,
    secondaryLabel: "How it works",
    secondaryHref: "#how",
  },
  {
    id: "listen",
    image: "/slides/02-city.jpg",
    thumb: "/slides/02-city.jpg",
    kicker: "Slide 02 · any platform",
    title: "Works when there are no Japanese subtitles.",
    body: "Listening Mode transcribes audio on Netflix, Crunchyroll, and YouTube while English subs stay on.",
    ctaLabel: "See pricing",
    ctaHref: "#pricing",
  },
  {
    id: "mist",
    image: "/slides/03-mist.jpg",
    thumb: "/slides/03-mist.jpg",
    kicker: "Slide 03 · beginners",
    title: "Romaji first. Kana when you are ready.",
    body: "Cards lead with taikutsu, not 退屈. You can start on episode one without reading hiragana.",
    ctaLabel: "Install free",
    ctaHref: GITHUB_URL,
  },
  {
    id: "sakura",
    image: "/slides/04-sakura.jpg",
    thumb: "/slides/04-sakura.jpg",
    kicker: "Slide 04 · memory",
    title: "Reviews find you in the next episode.",
    body: "Spaced repetition resurfaces words right before you would forget them. No Anki session required.",
    ctaLabel: "Compare tools",
    ctaHref: "/learn-japanese-with-anime",
  },
  {
    id: "night",
    image: "/slides/05-night.jpg",
    thumb: "/slides/05-night.jpg",
    kicker: "Slide 05 · private",
    title: "Your progress stays on your device.",
    body: "No account, no analytics, no selling data. Open source under AGPL on GitHub.",
    ctaLabel: "View on GitHub",
    ctaHref: GITHUB_URL,
  },
];
