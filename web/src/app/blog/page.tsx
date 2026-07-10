import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { blogPosts } from "@/content/blog/posts";
import { GITHUB_URL, SITE_URL, installUrl } from "@/lib/site";
import { blogJsonLd, defaultOpenGraph, defaultTwitter } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog · Learn Japanese from Anime & Manga",
  description:
    "Guides on learning Japanese with anime — Crunchyroll without JP subs, best beginner shows, spaced repetition, AI manga maker, shadowing, and tool comparisons.",
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    ...defaultOpenGraph,
    title: "AnimeVocab Blog · Learn Japanese from Anime",
    description:
      "Research-backed guides: Crunchyroll, Netflix, SRS, romaji-first learning, Manga Studio, and immersion workflows.",
    url: `${SITE_URL}/blog`,
  },
  twitter: {
    ...defaultTwitter,
    title: "AnimeVocab Blog",
    description: "Learn Japanese from anime and manga — guides, comparisons, and study workflows.",
  },
};

export default function BlogIndexPage() {
  const jsonLd = blogJsonLd(
    blogPosts.map((p) => ({
      title: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      publishedAt: p.publishedAt,
    }))
  );

  const sorted = [...blogPosts].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader compact />
      <main id="main">
        <section className="cmp-hero">
          <div className="wrap">
            <p className="eyebrow">Guides & research</p>
            <h1>Learn Japanese from anime — for real</h1>
            <p className="lede">
              Practical posts on Crunchyroll, Netflix, spaced repetition, Manga Studio, and tools — written for
              learners who want listening gains, not binge guilt.
            </p>
          </div>
        </section>

        <section style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="blog-grid">
              {sorted.map((post) => (
                <article key={post.slug} className="blog-card">
                  <p className="eyebrow">
                    {new Date(post.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {post.readingMinutes} min
                  </p>
                  <h2>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p>{post.description}</p>
                  <Link className="dash-cta" href={`/blog/${post.slug}`}>
                    Read article →
                  </Link>
                </article>
              ))}
            </div>

            <aside className="blog-hub-links">
              <h2>Tool comparisons & guides</h2>
              <ul>
                <li>
                  <Link href="/free-japanese-anime-extension">Free Japanese anime extension</Link>
                </li>
                <li>
                  <Link href="/blog/google-search-console-anime-site-indexing-2026">
                    GSC after sitemap submit
                  </Link>
                </li>
                <li>
                  <Link href="/blog/re-zero-learn-japanese-2026">Re:Zero for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/konosuba-learn-japanese-2026">KonoSuba for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/that-time-i-got-reincarnated-as-a-slime-learn-japanese-2026">
                    Slime / Tensura for Japanese?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/my-hero-academia-learn-japanese-2026">
                    My Hero Academia for Japanese?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/bleach-learn-japanese-beginners-2026">Bleach for beginners?</Link>
                </li>
                <li>
                  <Link href="/blog/blue-lock-learn-japanese-2026">Blue Lock for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/oshi-no-ko-learn-japanese-2026">Oshi no Ko for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/best-anime-movies-learn-japanese-2026">
                    Best anime movies for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/mob-psycho-100-learn-japanese-2026">Mob Psycho 100 for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/one-punch-man-learn-japanese-2026">One Punch Man for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/dan-da-dan-learn-japanese-2026">Dan Da Dan for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/clannad-learn-japanese-2026">Clannad for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/toradora-learn-japanese-2026">Toradora for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/fruits-basket-learn-japanese-2026">Fruits Basket for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/can-you-learn-japanese-only-watching-anime-2026">
                    Learn Japanese only by watching anime?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/evangelion-learn-japanese-2026">Evangelion for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/hunter-x-hunter-learn-japanese-2026">HxH for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/code-geass-learn-japanese-2026">Code Geass for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/learn-japanese-with-anime-reddit-myths-2026">
                    Reddit myths about anime immersion
                  </Link>
                </li>
                <li>
                  <Link href="/blog/cowboy-bebop-learn-japanese-2026">Cowboy Bebop for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/fullmetal-alchemist-learn-japanese-2026">
                    Fullmetal Alchemist for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/steins-gate-learn-japanese-2026">Steins;Gate for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/how-to-take-notes-while-watching-anime-japanese-2026">
                    How to take notes while watching anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/free-vs-paid-japanese-anime-tools-2026">
                    Free vs paid anime Japanese tools
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-to-shadow-anime-japanese-beginners-2026">
                    How to shadow anime (beginners)
                  </Link>
                </li>
                <li>
                  <Link href="/blog/anime-japanese-slang-beginners-2026">Anime slang for beginners</Link>
                </li>
                <li>
                  <Link href="/blog/netflix-japanese-audio-not-available-2026">
                    Netflix Japanese audio missing?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/princess-mononoke-learn-japanese-2026">
                    Princess Mononoke for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/weathering-with-you-learn-japanese-2026">
                    Weathering with You for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-youtube-channels-learn-japanese-anime-fans-2026">
                    Best YouTube channels for anime fans
                  </Link>
                </li>
                <li>
                  <Link href="/blog/is-crunchyroll-premium-worth-it-learn-japanese-2026">
                    Is Crunchyroll Premium worth it?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/spirited-away-learn-japanese-2026">Spirited Away for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/howls-moving-castle-learn-japanese-2026">
                    Howl&apos;s Moving Castle for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/jlpt-n4-anime-vocabulary-2026">JLPT N4 vocab from anime</Link>
                </li>
                <li>
                  <Link href="/blog/watching-anime-with-japanese-audio-english-subs-2026">
                    JP audio + EN subs — enough?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/your-name-learn-japanese-2026">Your Name for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/a-silent-voice-learn-japanese-2026">A Silent Voice for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/violet-evergarden-learn-japanese-2026">
                    Violet Evergarden for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/should-i-turn-off-english-subtitles-anime-2026">
                    Should I turn off English subs?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/kaguya-sama-learn-japanese-2026">Kaguya-sama for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/pokemon-learn-japanese-beginners-2026">Pokémon for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/detective-conan-learn-japanese-2026">Detective Conan for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/learn-japanese-commute-anime-clips-2026">
                    Commute anime clip study
                  </Link>
                </li>
                <li>
                  <Link href="/blog/does-crunchyroll-have-japanese-subtitles-2026">
                    Does Crunchyroll have JP subs?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-free-language-reactor-alternative-2026">
                    Best free Language Reactor alternative
                  </Link>
                </li>
                <li>
                  <Link href="/blog/chainsaw-man-learn-japanese-2026">Chainsaw Man for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/solo-leveling-learn-japanese-2026">Solo Leveling for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/one-piece-learn-japanese-beginners-2026">
                    One Piece for beginners?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/naruto-learn-japanese-beginners-2026">Naruto for beginners?</Link>
                </li>
                <li>
                  <Link href="/blog/free-japanese-learning-discord-anime-2026">
                    Free Japanese Discords for anime fans
                  </Link>
                </li>
                <li>
                  <Link href="/blog/chrome-extension-not-working-crunchyroll-2026">
                    Extension broken on Crunchyroll?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/demon-slayer-learn-japanese-beginners-2026">
                    Demon Slayer for beginners?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/jujutsu-kaisen-learn-japanese-2026">Jujutsu Kaisen for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/how-many-anime-episodes-learn-japanese-2026">
                    How many episodes to learn Japanese?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/yomichan-yomitan-anime-netflix-2026">
                    Yomitan / Yomichan for Netflix anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/death-note-learn-japanese-2026">Death Note for Japanese?</Link>
                </li>
                <li>
                  <Link href="/blog/attack-on-titan-learn-japanese-beginners-2026">
                    Attack on Titan for beginners?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/privacy-chrome-extension-japanese-learning-2026">
                    Extension privacy checklist
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-time-watch-anime-learn-japanese-2026">
                    Best time to watch for study
                  </Link>
                </li>
                <li>
                  <Link href="/blog/horimiya-learn-japanese-2026">Horimiya for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/my-neighbor-totoro-learn-japanese-kids-2026">
                    Totoro for kids / families
                  </Link>
                </li>
                <li>
                  <Link href="/blog/anki-shared-decks-anime-beginners-2026">
                    Anki anime shared decks warning
                  </Link>
                </li>
                <li>
                  <Link href="/blog/japanese-subtitles-vs-english-anime-2026">
                    JP vs EN subtitles for learning
                  </Link>
                </li>
                <li>
                  <Link href="/blog/vinland-saga-learn-japanese-2026">Vinland Saga for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/haikyuu-learn-japanese-2026">Haikyuu for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/language-reactor-crunchyroll-2026">
                    Language Reactor on Crunchyroll?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/is-duolingo-enough-japanese-anime-2026">
                    Is Duolingo enough + anime?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/natsume-yuujinchou-learn-japanese-2026">
                    Natsume for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/mushishi-learn-japanese-2026">Mushishi for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/best-free-websites-learn-japanese-anime-2026">
                    Best free Japanese websites
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-to-remember-anime-vocabulary-2026">
                    How to remember anime vocab
                  </Link>
                </li>
                <li>
                  <Link href="/learn-japanese-hulu">Learn Japanese on Hulu</Link>
                </li>
                <li>
                  <Link href="/migaku-free-alternative">Migaku free alternative</Link>
                </li>
                <li>
                  <Link href="/manabidojo-alternative">ManabiDojo alternative</Link>
                </li>
                <li>
                  <Link href="/blog/cancel-migaku-keep-learning-anime-2026">
                    Canceling Migaku — keep learning
                  </Link>
                </li>
                <li>
                  <Link href="/blog/jisho-vs-anime-vocabulary-tools-2026">Jisho vs anime tools</Link>
                </li>
                <li>
                  <Link href="/blog/bocchi-the-rock-learn-japanese-2026">Bocchi the Rock for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/laid-back-camp-learn-japanese-2026">Yuru Camp for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/barakamon-learn-japanese-2026">Barakamon for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/marumori-vs-anime-immersion-2026">MaruMori vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/satori-reader-vs-anime-2026">Satori Reader vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/todaii-easy-japanese-vs-anime-2026">Todaii vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/kanji-study-app-vs-anime-2026">Kanji apps vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/funimation-to-crunchyroll-learn-japanese-2026">
                    Funimation → Crunchyroll study guide
                  </Link>
                </li>
                <li>
                  <Link href="/blog/chiikawa-learn-japanese-2026">Chiikawa for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/spy-x-family-learn-japanese-2026">Spy x Family for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/frieren-learn-japanese-2026">Frieren for Japanese</Link>
                </li>
                <li>
                  <Link href="/blog/chrome-web-store-japanese-anime-extension-2026">
                    Chrome Web Store anime extension guide
                  </Link>
                </li>
                <li>
                  <Link href="/learn-japanese-hidive">Learn Japanese on HIDIVE</Link>
                </li>
                <li>
                  <Link href="/blog/jpdb-vs-anime-vocabulary-2026">jpdb vs anime vocab</Link>
                </li>
                <li>
                  <Link href="/blog/tae-kim-grammar-vs-anime-2026">Tae Kim vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/free-anki-alternative-anime-srs-2026">
                    Free Anki alternative for anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/lingq-vs-anime-learn-japanese-2026">LingQ vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/japanesepod101-vs-anime-2026">JapanesePod101 vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/clozemaster-vs-anime-vocabulary-2026">
                    Clozemaster vs anime vocab
                  </Link>
                </li>
                <li>
                  <Link href="/blog/genki-textbook-vs-anime-immersion-2026">
                    Genki vs anime immersion
                  </Link>
                </li>
                <li>
                  <Link href="/blog/graded-readers-vs-writing-manga-2026">
                    Graded readers vs writing manga
                  </Link>
                </li>
                <li>
                  <Link href="/blog/refold-anime-immersion-beginners-2026">
                    Refold-style immersion with anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/tofugu-anime-advice-2026">Tofugu-style advice vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/lingodeer-vs-anime-learn-japanese-2026">LingoDeer vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/renshuu-vs-anime-study-2026">Renshuu vs anime study</Link>
                </li>
                <li>
                  <Link href="/blog/busuu-vs-anime-learn-japanese-2026">Busuu vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/memrise-vs-anime-vocabulary-2026">Memrise vs anime vocab</Link>
                </li>
                <li>
                  <Link href="/blog/italki-vs-anime-immersion-2026">iTalki vs anime immersion</Link>
                </li>
                <li>
                  <Link href="/blog/rosetta-stone-vs-anime-japanese-2026">
                    Rosetta Stone vs anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/ankiapp-vs-animevocab-srs-2026">
                    AnkiApp vs built-in anime SRS
                  </Link>
                </li>
                <li>
                  <Link href="/blog/hello-talk-vs-anime-immersion-2026">
                    HelloTalk vs anime immersion
                  </Link>
                </li>
                <li>
                  <Link href="/blog/duolingo-vs-anime-learn-japanese-2026">
                    Duolingo vs anime for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/pimsleur-vs-anime-learn-japanese-2026">
                    Pimsleur vs anime for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/spotify-japanese-podcasts-anime-fans-2026">
                    Best Japanese podcasts for anime fans
                  </Link>
                </li>
                <li>
                  <Link href="/blog/nhk-easy-vs-anime-2026">NHK Easy vs anime</Link>
                </li>
                <li>
                  <Link href="/blog/podcasts-vs-anime-learn-japanese-2026">
                    Podcasts vs anime for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/drama-vs-anime-learn-japanese-2026">
                    J-dramas vs anime for learning
                  </Link>
                </li>
                <li>
                  <Link href="/blog/genshin-impact-learn-japanese-2026">
                    Genshin Impact for learning Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/discord-japanese-immersion-anime-2026">
                    Discord Japanese immersion + anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/wanikani-vs-anime-vocabulary-2026">
                    WaniKani vs anime vocabulary
                  </Link>
                </li>
                <li>
                  <Link href="/blog/bunpro-vs-anime-grammar-2026">Bunpro vs anime grammar</Link>
                </li>
                <li>
                  <Link href="/blog/furigana-anime-subtitles-beginners-2026">
                    Furigana on anime subtitles
                  </Link>
                </li>
                <li>
                  <Link href="/blog/pitch-accent-anime-beginners-2026">
                    Pitch accent from anime for beginners
                  </Link>
                </li>
                <li>
                  <Link href="/blog/avoid-shonen-learn-japanese-beginners-2026">
                    Why beginners should avoid shonen
                  </Link>
                </li>
                <li>
                  <Link href="/blog/dual-subtitles-japanese-beginners-2026">
                    Dual subtitles for beginners
                  </Link>
                </li>
                <li>
                  <Link href="/blog/slice-of-life-anime-learn-japanese-2026">
                    Best slice-of-life anime for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/open-source-japanese-anime-tools-2026">
                    Open source anime Japanese tools
                  </Link>
                </li>
                <li>
                  <Link href="/blog/rewatching-anime-learn-japanese-2026">
                    Rewatching anime to learn Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/mobile-learn-japanese-anime-2026">
                    Learn Japanese from anime on mobile
                  </Link>
                </li>
                <li>
                  <Link href="/blog/learn-japanese-from-anime-reddit-2026">
                    Learn Japanese from anime — Reddit advice
                  </Link>
                </li>
                <li>
                  <Link href="/blog/vocabulary-notebook-vs-srs-anime-2026">
                    Vocabulary notebook vs SRS
                  </Link>
                </li>
                <li>
                  <Link href="/blog/is-anime-enough-to-learn-japanese-2026">
                    Is anime enough to learn Japanese?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/chrome-extension-crunchyroll-no-japanese-subs-2026">
                    Crunchyroll extension without JP subs
                  </Link>
                </li>
                <li>
                  <Link href="/blog/how-long-learn-japanese-anime-2026">
                    How long to learn Japanese with anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/stop-using-english-subtitles-japanese-2026">
                    Stop relying on English subtitles
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-time-of-day-study-japanese-anime-2026">
                    Best time of day to study with anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/kikis-delivery-service-learn-japanese-2026">
                    Kiki's Delivery Service for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/youtube-vs-netflix-learn-japanese-anime-2026">
                    YouTube vs Netflix for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/totoro-learn-japanese-2026">Totoro for Japanese learners</Link>
                </li>
                <li>
                  <Link href="/blog/netflix-vs-crunchyroll-learn-japanese-2026">
                    Netflix vs Crunchyroll for Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/ghibli-movies-learn-japanese-2026">
                    Ghibli movies to learn Japanese
                  </Link>
                </li>
                <li>
                  <Link href="/blog/jlpt-n5-anime-vocabulary-2026">JLPT N5 vocabulary from anime</Link>
                </li>
                <li>
                  <Link href="/blog/comprehensible-input-anime-2026">
                    Comprehensible input with anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/japanese-listening-practice-anime-2026">
                    Japanese listening practice with anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/hiragana-before-anime-or-after-2026">
                    Hiragana before anime — or after?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-free-japanese-learning-apps-anime-2026">
                    Best free Japanese apps for anime fans
                  </Link>
                </li>
                <li>
                  <Link href="/blog/passive-anime-watching-vs-active-study-2026">
                    Passive vs active anime study
                  </Link>
                </li>
                <li>
                  <Link href="/blog/does-watching-anime-help-learn-japanese-2026">
                    Does watching anime help learn Japanese?
                  </Link>
                </li>
                <li>
                  <Link href="/blog/learn-japanese-while-watching-crunchyroll-2026">
                    Learn Japanese while watching Crunchyroll
                  </Link>
                </li>
                <li>
                  <Link href="/blog/anki-anime-beginners-2026">Anki for anime beginners</Link>
                </li>
                <li>
                  <Link href="/blog/sazae-san-learn-japanese-2026">Sazae-san for Japanese learners</Link>
                </li>
                <li>
                  <Link href="/blog/crunchyroll-japanese-learning-extension-2026">
                    Best Crunchyroll Japanese extensions
                  </Link>
                </li>
                <li>
                  <Link href="/blog/free-ways-learn-japanese-anime-2026">
                    Free ways to learn Japanese from anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/chrome-extension-learn-japanese-netflix-2026">
                    Best Netflix Japanese extensions
                  </Link>
                </li>
                <li>
                  <Link href="/blog/k-on-learn-japanese-2026">K-On! for Japanese learners</Link>
                </li>
                <li>
                  <Link href="/blog/anime-immersion-beginners-guide-2026">
                    Anime immersion for beginners
                  </Link>
                </li>
                <li>
                  <Link href="/blog/doraemon-learn-japanese-2026">Doraemon for Japanese learners</Link>
                </li>
                <li>
                  <Link href="/blog/how-to-learn-japanese-watching-anime-2026">
                    How to learn Japanese watching anime
                  </Link>
                </li>
                <li>
                  <Link href="/blog/language-reactor-free-alternative-2026">
                    Language Reactor free alternative
                  </Link>
                </li>
                <li>
                  <Link href="/blog/is-migaku-worth-it-2026">Is Migaku worth it? (2026)</Link>
                </li>
                <li>
                  <Link href="/blog/non-non-biyori-learn-japanese-2026">
                    Non Non Biyori for Japanese learners
                  </Link>
                </li>
                <li>
                  <Link href="/blog/shirokuma-cafe-learn-japanese-2026">
                    Shirokuma Cafe for Japanese learners
                  </Link>
                </li>
                <li>
                  <Link href="/blog/migaku-crunchyroll-alternative-2026">
                    Migaku Crunchyroll alternative
                  </Link>
                </li>
                <li>
                  <Link href="/blog/substital-crunchyroll-japanese-subtitles-2026">
                    Substital on Crunchyroll guide
                  </Link>
                </li>
                <li>
                  <Link href="/learn-japanese-disney-plus">Learn Japanese on Disney+</Link>
                </li>
                <li>
                  <Link href="/blog/best-apps-learn-japanese-anime-2026">
                    Best apps to learn Japanese with anime (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/blog/yomitan-anime-alternative-video-immersion-2026">
                    Yomitan for anime — video alternatives
                  </Link>
                </li>
                <li>
                  <Link href="/vs-wordy">AnimeVocab vs Wordy</Link>
                </li>
                <li>
                  <Link href="/vs-asbplayer">AnimeVocab vs asbplayer</Link>
                </li>
                <li>
                  <Link href="/blog/kitsunekko-subtitles-anime-2026">Kitsunekko subtitle guide</Link>
                </li>
                <li>
                  <Link href="/blog/word-manga-vocabulary-practice-2026">Word Manga vocabulary</Link>
                </li>
                <li>
                  <Link href="/blog/uplang-netflix-dual-subtitles-2026">
                    Uplang vs HASHIGO on Netflix
                  </Link>
                </li>
                <li>
                  <Link href="/vs-yumego">AnimeVocab vs YumeGo</Link>
                </li>
                <li>
                  <Link href="/vs-lingoku">AnimeVocab vs Lingoku</Link>
                </li>
                <li>
                  <Link href="/blog/subminer-vs-asbplayer-anime-mining-2026">
                    SubMiner vs asbplayer mining
                  </Link>
                </li>
                <li>
                  <Link href="/blog/lingoku-alternative-anime-japanese-2026">
                    Lingoku vs AnimeVocab (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/blog/hashigo-yomitan-netflix-japanese-anime-2026">
                    HASHIGO, Yomitan & Netflix subs
                  </Link>
                </li>
                <li>
                  <Link href="/blog/asbplayer-alternative-beginners-anime-japanese">
                    asbplayer vs beginner tools
                  </Link>
                </li>
                <li>
                  <Link href="/blog/best-chrome-extensions-learn-japanese-anime-2026">
                    Best Chrome extensions for anime Japanese (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/learn-japanese-with-anime">How to learn Japanese with anime (2026)</Link>
                </li>
                <li>
                  <Link href="/fan-ending-manga">Fan ending manga — choose your ending</Link>
                </li>
                <li>
                  <Link href="/ai-manga-ending-generator">AI manga ending generator</Link>
                </li>
                <li>
                  <Link href="/end">Endings catalog (fan art)</Link>
                </li>
                <li>
                  <Link href="/blog/fan-ending-manga-ai-generator-2026">
                    Fan ending AI generator (2026)
                  </Link>
                </li>
                <li>
                  <Link href="/ai-manga-maker">AI manga maker — create manga online free</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-manga">Learn Japanese by writing manga</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-crunchyroll">Learn Japanese on Crunchyroll</Link>
                </li>
                <li>
                  <Link href="/blog/jimaku-crunchyroll-subtitles-vs-listening-mode">
                    Jimaku vs Listening Mode (Crunchyroll)
                  </Link>
                </li>
                <li>
                  <Link href="/best-anime-to-learn-japanese">Best anime for beginners</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-youtube-anime">Learn Japanese on YouTube anime</Link>
                </li>
                <li>
                  <Link href="/romaji-japanese-learning">Romaji-first learning</Link>
                </li>
                <li>
                  <Link href="/anime-spaced-repetition">Spaced repetition for anime</Link>
                </li>
                <li>
                  <Link href="/learn-japanese-netflix-anime">Learn Japanese on Netflix</Link>
                </li>
                <li>
                  <Link href="/cloud">AnimeVocab Cloud</Link>
                </li>
                <li>
                  <Link href="/vs-lexirise">AnimeVocab vs Lexirise</Link>
                </li>
                <li>
                  <Link href="/vs-animelon">AnimeVocab vs Animelon</Link>
                </li>
                <li>
                  <Link href="/vs-manabidojo">AnimeVocab vs ManabiDojo</Link>
                </li>
                <li>
                  <Link href="/manabidojo-alternative">ManabiDojo alternative hub</Link>
                </li>
                <li>
                  <Link href="/vs-language-reactor">AnimeVocab vs Language Reactor</Link>
                </li>
                <li>
                  <Link href="/vs-migaku">AnimeVocab vs Migaku</Link>
                </li>
                <li>
                  <Link href="/migaku-free-alternative">Migaku free alternative hub</Link>
                </li>
                <li>
                  <Link href="/vs-trancy">AnimeVocab vs Trancy</Link>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="closing">
          <div className="wrap narrow">
            <h2>Ready to learn from tonight&apos;s episode?</h2>
            <a className="btn btn-accent" href={installUrl()} rel="noopener noreferrer">
              Add AnimeVocab to Chrome
            </a>
          </div>
        </section>
      </main>
      <SiteFooter
        links={[
          { href: "/learn-japanese-with-anime", label: "Compare" },
          { href: "/learn-japanese-crunchyroll", label: "Crunchyroll" },
          { href: "/privacy", label: "Privacy" },
          { href: GITHUB_URL, label: "GitHub" },
        ]}
      />
    </>
  );
}
