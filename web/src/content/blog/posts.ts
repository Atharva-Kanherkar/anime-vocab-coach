import type { BlogPost } from "./types";

export const blogPosts: BlogPost[] = [
  {
    slug: "uplang-netflix-dual-subtitles-2026",
    title: "Uplang vs HASHIGO vs Language Reactor on Netflix (2026)",
    description:
      "Uplang Pro adds furigana modes on Netflix dual subs. Compare with HASHIGO JLPT coloring and Language Reactor for anime Japanese readers.",
    publishedAt: "2026-07-08T23:00:00.000Z",
    updatedAt: "2026-07-08T23:00:00.000Z",
    keywords: [
      "Uplang Netflix Japanese",
      "Uplang dual subtitles",
      "furigana Netflix extension",
      "learn Japanese Netflix subtitles",
    ],
    readingMinutes: 7,
    ogImage: "/slides/05-private.jpg",
    blocks: [
      {
        type: "p",
        text: "**Uplang** is a paid Netflix reader extension with **furigana modes** (always, hover, unknown-only) on dual subtitles plus AI translation options. Learners who already read kana often compare it to **HASHIGO!** (JLPT color + furigana) and **Language Reactor** (mature dual-sub player). None of these solve **Crunchyroll without JP subs** — that is still AnimeVocab's Listening Mode lane.",
      },
      { type: "h2", text: "Uplang — when furigana control matters" },
      {
        type: "ul",
        items: [
          "**Furigana modes** — show readings always, on hover, or only for unknown kanji.",
          "**Dual subs** — Japanese + English on Netflix.",
          "**Pro tier** — subscription for full feature set.",
        ],
      },
      { type: "h2", text: "HASHIGO! — JLPT coloring lane" },
      {
        type: "p",
        text: "**HASHIGO!** colors vocabulary by JLPT band and adds furigana on Netflix Japanese subs — great for parsing dense slice-of-life dialogue. Stack with **Yomitan** for dictionary mining. Full walkthrough: [HASHIGO + Yomitan reader stack](/blog/hashigo-yomitan-netflix-japanese-anime-2026).",
      },
      { type: "h2", text: "Language Reactor — the default dual-sub player" },
      {
        type: "p",
        text: "Free-tier **Language Reactor** on Netflix/YouTube is still the baseline recommendation for readers who do not need furigana overlays. Compare [AnimeVocab vs Language Reactor](/vs-language-reactor) if you are not ready to read kana.",
      },
      { type: "h2", text: "Before any Netflix reader extension" },
      {
        type: "p",
        text: "Confirm a **Japanese subtitle track** exists (not English only). Hub: [learn Japanese on Netflix anime](/learn-japanese-netflix-anime). Month-zero path: [romaji-first guide](/romaji-japanese-learning). AI readers: [Lingoku](/vs-lingoku), [YumeGo](/vs-yumego).",
      },
    ],
  },
  {
    slug: "yumego-alternative-anime-japanese-2026",
    title: "YumeGo Alternative (2026): Netflix Grammar Reader vs Crunchyroll Romaji",
    description:
      "YumeGo adds AI grammar and dual subtitles on Netflix and Disney+. When to use it vs AnimeVocab for Crunchyroll, romaji beginners, and Listening Mode.",
    publishedAt: "2026-07-08T22:00:00.000Z",
    updatedAt: "2026-07-08T22:00:00.000Z",
    keywords: [
      "YumeGo alternative",
      "YumeGo Japanese Netflix",
      "learn japanese disney plus extension",
      "dual subtitles netflix japanese",
    ],
    readingMinutes: 7,
    ogImage: "/slides/05-private.jpg",
    canonicalPath: "/vs-yumego",
    blocks: [
      {
        type: "p",
        text: "**YumeGo** targets Netflix and Disney+ with hover grammar breakdowns, JLPT-tagged saves, phrase libraries, and dual subtitles — strong if you already read Japanese on screen. Free users get a **daily active translation cap** (~20 minutes). If you searched **YumeGo alternative** because you watch **Crunchyroll** or cannot read kana yet, the comparison shifts fast. Side-by-side: [AnimeVocab vs YumeGo](/vs-yumego).",
      },
      { type: "h2", text: "YumeGo strengths" },
      {
        type: "ul",
        items: [
          "**Grammar popups** — particles and conjugation explained in context (DeepSeek-backed).",
          "**Phrase library** — save lines with JLPT level and review queue.",
          "**Dual subs** — Japanese + your language with optional blur-for-test mode.",
          "**Netflix + Disney+** — polished overlay without leaving the player.",
        ],
      },
      { type: "h2", text: "Gaps YumeGo does not cover" },
      {
        type: "ul",
        items: [
          "**No Crunchyroll** — simulcast learners need a different extension.",
          "**Assumes script literacy** — romaji-first month-zero is out of scope.",
          "**No audio transcription** when JP subtitle text is missing.",
          "**Daily free cap** on active translation vs unlimited card capture elsewhere.",
        ],
      },
      { type: "h2", text: "Pick AnimeVocab instead when…" },
      {
        type: "p",
        text: "You watch **Crunchyroll** without Japanese subtitles, want **romaji-first cards**, or need **Listening Mode** on tab audio. Netflix readers can still pair HASHIGO + Yomitan ([reader stack](/blog/hashigo-yomitan-netflix-japanese-anime-2026)) or try **Lingoku** ([vs Lingoku](/vs-lingoku)) for AI dual subs.",
      },
      {
        type: "p",
        text: "Netflix hub: [learn Japanese on Netflix anime](/learn-japanese-netflix-anime). Extension ranking: [best Chrome extensions (2026)](/blog/best-chrome-extensions-learn-japanese-anime-2026).",
      },
    ],
  },
  {
    slug: "lingoku-alternative-anime-japanese-2026",
    title: "Lingoku vs AnimeVocab: AI Dual Subs vs Romaji-First Anime Cards (2026)",
    description:
      "Lingoku blends AI dual subtitles and web word injection on Netflix and YouTube. AnimeVocab targets month-zero learners with romaji-first cards and Listening Mode on Crunchyroll.",
    publishedAt: "2026-07-08T20:00:00.000Z",
    updatedAt: "2026-07-08T20:00:00.000Z",
    keywords: [
      "Lingoku alternative",
      "Lingoku Japanese Netflix",
      "AI dual subtitles Japanese",
      "learn Japanese browser extension",
      "comprehensible input anime",
    ],
    readingMinutes: 8,
    ogImage: "/slides/10-coach.webp",
    canonicalPath: "/vs-lingoku",
    blocks: [
      {
        type: "p",
        text: "**Lingoku** is the 2026 newcomer getting press for **AI dual subtitles** on Netflix, YouTube, and Bilibili — plus **word blending** on English websites so Japanese tokens appear in articles you already read. It is built on comprehensible-input theory with BYOK AI (Ollama, DeepSeek, OpenAI). If you searched **Lingoku alternative**, the real question is whether you are ready to **read Japanese subtitles** or still need **romaji-first audio help**. Side-by-side: [AnimeVocab vs Lingoku](/vs-lingoku).",
      },
      { type: "h2", text: "What Lingoku does well" },
      {
        type: "ul",
        items: [
          "**AI dual subs** — hover definitions without pausing on Netflix/YouTube.",
          "**Web immersion** — swaps ~10% of English page words into Japanese at your JLPT band.",
          "**No account required** — install, bring your own API key, start.",
          "**SRS exposure** — reviews words you have seen in real browsing contexts.",
        ],
      },
      { type: "h2", text: "Where Lingoku assumes more than beginners have" },
      {
        type: "p",
        text: "Dual subtitles and web word injection still assume you can **parse kana** and tolerate Japanese script on screen. Crunchyroll often ships **English-only** subs on simulcasts — Lingoku cannot invent Japanese text that is not there. Month-zero learners hear words but cannot read them; that is the gap **AnimeVocab** fills with **romaji-first cards** and **Listening Mode** transcription.",
      },
      { type: "h2", text: "AnimeVocab vs Lingoku — quick matrix" },
      {
        type: "ul",
        items: [
          "**Lingoku** — AI-heavy reader stack for Netflix/YouTube; great if you read kana and want contextual AI glosses.",
          "**AnimeVocab** — one romaji word per line + built-in SRS on Crunchyroll, Netflix, YouTube; no API key setup.",
          "**Language Reactor** — mature dual-sub player without AI blending ([comparison](/vs-language-reactor)).",
          "**HASHIGO + Yomitan** — furigana + dictionary mining when JP subs exist ([Netflix reader stack](/blog/hashigo-yomitan-netflix-japanese-anime-2026)).",
        ],
      },
      { type: "h2", text: "Suggested progression" },
      {
        type: "p",
        text: "Start with **romaji-first audio cards** until ~50 words stick by sound ([romaji guide](/romaji-japanese-learning)). Add **Lingoku or Language Reactor** once hiragana feels familiar. Graduate to **asbplayer sentence mining** when you want Anki pipelines ([asbplayer vs beginners](/blog/asbplayer-alternative-beginners-anime-japanese)).",
      },
      {
        type: "p",
        text: "Full extension ranking: [best Chrome extensions (2026)](/blog/best-chrome-extensions-learn-japanese-anime-2026). Master hub: [learn Japanese with anime](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "subminer-vs-asbplayer-anime-mining-2026",
    title: "SubMiner vs asbplayer: Desktop MPV Mining vs Browser Anime Sentence Cards (2026)",
    description:
      "SubMiner overlays mpv with bundled Yomitan and one-click Anki sentence cards. asbplayer mines in Chrome from fan subs. Which immersion mining stack fits anime learners?",
    publishedAt: "2026-07-08T21:00:00.000Z",
    updatedAt: "2026-07-08T21:00:00.000Z",
    keywords: [
      "SubMiner Japanese",
      "SubMiner vs asbplayer",
      "mpv sentence mining anime",
      "anki mining anime desktop",
      "sentence mining japanese immersion",
    ],
    readingMinutes: 8,
    ogImage: "/slides/08-final.jpg",
    blocks: [
      {
        type: "p",
        text: "**SubMiner** is the 2026 desktop answer to browser miners: an interactive overlay on **mpv** with bundled **Yomitan**, N+1 highlighting against your Anki decks, Jimaku subtitle search, and one-key sentence cards (audio + screenshot + line). **asbplayer** still owns the **Chrome + streaming site** lane. Neither helps if you **cannot read Japanese subtitles** yet — that is the romaji on-ramp gap [AnimeVocab](/) fills.",
      },
      { type: "h2", text: "SubMiner workflow (local files & mpv)" },
      {
        type: "ol",
        items: [
          "Install **mpv**, **Anki + AnkiConnect**, and **SubMiner** (Windows/macOS/Linux).",
          "Import Yomitan dictionaries on first run.",
          "Play anime with a Japanese `.srt` / `.ass` — fan subs from Jimaku or your own rips.",
          "Hover tokens in the on-screen subtitle overlay → Yomitan popup → mine sentence with **Ctrl/Cmd+S**.",
          "Track immersion hours in SubMiner's local dashboard.",
        ],
      },
      { type: "h2", text: "asbplayer workflow (browser streams)" },
      {
        type: "p",
        text: "**asbplayer** syncs subtitle files to Netflix/YouTube in the browser, mines to Anki with screenshots, and pairs with your own Yomitan install. No mpv required — but you still need **Japanese subtitle text** and comfort reading it. Beginner comparison: [asbplayer vs AnimeVocab](/blog/asbplayer-alternative-beginners-anime-japanese).",
      },
      { type: "h2", text: "SubMiner vs asbplayer — pick by habitat" },
      {
        type: "ul",
        items: [
          "**SubMiner** — you watch **local files** or Jellyfin, want mpv performance, bundled Yomitan, N+1 targeting, immersion stats.",
          "**asbplayer** — you mine **browser streams** with fan subs and already run a Chrome mining stack.",
          "**AnimeVocab** — you watch **Crunchyroll legally** without JP subs and need **romaji-first** cards + SRS ([Crunchyroll guide](/learn-japanese-crunchyroll)).",
          "**Both miners over time** — graduate from romaji audio cards once kana clicks ([romaji path](/romaji-japanese-learning)).",
        ],
      },
      {
        type: "p",
        text: "Extension roundup for readers: [best Chrome extensions (2026)](/blog/best-chrome-extensions-learn-japanese-anime-2026). Master ranking: [learn Japanese with anime](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "hashigo-yomitan-netflix-japanese-anime-2026",
    title: "HASHIGO, Yomitan, and Netflix Japanese Subtitles: A 2026 Reader's Stack",
    description:
      "Netflix anime often has Japanese subtitle tracks. HASHIGO adds furigana and JLPT colors; Yomitan mines to Anki. When you still cannot read kana, use romaji-first audio tools instead.",
    publishedAt: "2026-07-08T18:00:00.000Z",
    updatedAt: "2026-07-08T18:00:00.000Z",
    keywords: [
      "HASHIGO Netflix",
      "Yomitan anime",
      "Netflix Japanese subtitles furigana",
      "learn Japanese Netflix extension",
      "JLPT coloring subtitles",
    ],
    readingMinutes: 9,
    ogImage: "/slides/05-private.jpg",
    blocks: [
      {
        type: "p",
        text: "Once you confirm a **Japanese subtitle track** on Netflix anime, the tooling splits into two camps: **readers** who want furigana, dictionary popups, and Anki mining — and **listeners** who still need **romaji-first** help. This guide maps the reader stack (**HASHIGO!**, **Yomitan**, Language Reactor, Subkit) and when to skip straight to **audio-first** tools.",
      },
      { type: "h2", text: "Step zero: find real Japanese subs" },
      {
        type: "ul",
        items: [
          "Open Netflix subtitle settings on an anime title.",
          "Look for **Japanese** (not English only).",
          "Prefer standard dialogue subs over **[CC]** when both exist — CC includes sound descriptions but dialogue is still verbatim.",
          "If only English exists, jump to [Listening Mode / romaji tools](/learn-japanese-netflix-anime) instead of forcing a reading workflow.",
        ],
      },
      { type: "h2", text: "HASHIGO! — furigana and JLPT coloring on Netflix" },
      {
        type: "p",
        text: "**HASHIGO!** (Chrome) enhances Netflix Japanese subtitles with **furigana readings** and **JLPT-based color coding** so you can parse kanji-heavy lines while watching. It targets learners who already read kana but choke on unknown kanji density — not month-zero beginners. Pairs well with slice-of-life shows from our [best beginner anime](/best-anime-to-learn-japanese) list once you are past pure romaji.",
      },
      { type: "h2", text: "Yomitan — the dictionary layer everything bolts onto" },
      {
        type: "p",
        text: "**Yomitan** (successor to Yomichan) is the immersion community's default popup dictionary on any Japanese text in the browser. **asbplayer**, **Migaku**, and **ManabiDojo** all assume you will Yomitan-click unknown words. It does not teach you from zero — it accelerates lookup once you can see Japanese subtitles. Mining comparison: [asbplayer vs beginner tools](/blog/asbplayer-alternative-beginners-anime-japanese).",
      },
      { type: "h2", text: "Alternatives in the same lane" },
      {
        type: "ul",
        items: [
          "**Language Reactor** — dual subtitles + playback controls on Netflix/YouTube ([vs AnimeVocab](/vs-language-reactor)).",
          "**Subkit + Furigana add-on** — furigana overlay on Netflix, YouTube, Disney+ with AI translation options.",
          "**Uplang** — dual subs with furigana modes (always / hover / unknown-only) on a paid Pro tier.",
        ],
      },
      { type: "h2", text: "When this stack is the wrong answer" },
      {
        type: "p",
        text: "If you cannot read hiragana yet, furigana on Japanese subtitles still feels like a wall. Use **romaji-first** cards from audio ([romaji guide](/romaji-japanese-learning)) or **Crunchyroll audio transcription** ([Crunchyroll guide](/learn-japanese-crunchyroll)). Graduate into HASHIGO + Yomitan after ~50 words by sound.",
      },
      {
        type: "p",
        text: "Netflix hub: [learn Japanese on Netflix anime](/learn-japanese-netflix-anime). Extension roundup: [best Chrome extensions (2026)](/blog/best-chrome-extensions-learn-japanese-anime-2026).",
      },
    ],
  },
  {
    slug: "asbplayer-alternative-beginners-anime-japanese",
    title: "asbplayer vs AnimeVocab: Sentence Mining vs One-Word Beginner Cards (2026)",
    description:
      "asbplayer and SubMiner are built for Anki sentence miners who read Japanese subtitles. AnimeVocab is the romaji-first on-ramp when you cannot — honest comparison for anime learners.",
    publishedAt: "2026-07-08T16:00:00.000Z",
    updatedAt: "2026-07-08T16:00:00.000Z",
    keywords: [
      "asbplayer alternative",
      "sentence mining japanese anime",
      "anki anime mining",
      "subminer japanese",
      "beginner japanese immersion",
    ],
    readingMinutes: 8,
    ogImage: "/slides/11-cards.webp",
    blocks: [
      {
        type: "p",
        text: "**asbplayer** is the immersion community's favorite browser miner: sync fan subtitles, screenshot+audio+sentence into Anki, bolt on Yomitan. New desktop tools like **SubMiner** (mpv-native) push the same workflow without browser overhead — see [SubMiner vs asbplayer](/blog/subminer-vs-asbplayer-anime-mining-2026). None of them solve the **month-zero** problem: you still need to **read Japanese subtitles** and run a mining stack.",
      },
      { type: "h2", text: "What asbplayer-style tools assume" },
      {
        type: "ul",
        items: [
          "You have or can find **Japanese subtitle files** (Jimaku, Kitsunekko).",
          "You read kana/kanji well enough to click tokens.",
          "You maintain **Anki** as the review system of record.",
          "You tolerate **setup per show** (alignment, decks, note types).",
        ],
      },
      { type: "h2", text: "Where AnimeVocab differs" },
      {
        type: "p",
        text: "AnimeVocab is not a sentence miner. It pushes **one curated romaji-first word per line** with **built-in SRS** on Crunchyroll, Netflix, and YouTube — including **Listening Mode** when no JP subtitle track exists. Think **on-ramp**, not Anki pipeline replacement. Compare [vs Migaku](/vs-migaku) (deeper mining suite) and [vs Language Reactor](/vs-language-reactor) (dual-sub reader).",
      },
      { type: "h2", text: "When to use which" },
      {
        type: "ul",
        items: [
          "**asbplayer / SubMiner / Migaku** — you read JP subs and want rich sentence cards.",
          "**AnimeVocab** — you hear words but cannot read them yet, or Crunchyroll has no minable text.",
          "**Both over time** — romaji cards first, graduate to miners once kana clicks ([romaji guide](/romaji-japanese-learning)).",
        ],
      },
      {
        type: "p",
        text: "Extension roundup: [best Chrome extensions for anime Japanese (2026)](/blog/best-chrome-extensions-learn-japanese-anime-2026). Master ranking: [learn Japanese with anime](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "best-chrome-extensions-learn-japanese-anime-2026",
    title: "Best Chrome Extensions to Learn Japanese from Anime (2026 Ranked)",
    description:
      "Ranked Chrome extensions for learning Japanese on Crunchyroll and Netflix — AnimeVocab, Lexirise, ManabiDojo, Language Reactor, Migaku, and Trancy. Who each tool is for.",
    publishedAt: "2026-07-08T14:00:00.000Z",
    updatedAt: "2026-07-08T14:00:00.000Z",
    keywords: [
      "best chrome extension learn japanese",
      "chrome extension japanese anime",
      "learn japanese netflix extension",
      "crunchyroll japanese learning extension",
      "language reactor alternative",
    ],
    readingMinutes: 10,
    ogImage: "/slides/11-cards.webp",
    blocks: [
      {
        type: "p",
        text: "Searching **best Chrome extension learn Japanese anime** returns a wall of dual-subtitle miners. Most assume you already **read hiragana**. This ranking sorts extensions by **platform (Crunchyroll vs Netflix)**, **reading level**, and **whether you want setup or a one-word tonight** — not by Chrome Web Store star count alone.",
      },
      { type: "h2", text: "Quick picks by situation" },
      {
        type: "ul",
        items: [
          "**Cannot read kana yet, watch Crunchyroll** → [AnimeVocab](/) (romaji + Listening Mode)",
          "**Read Japanese subs, mine Crunchyroll** → [Lexirise](/vs-lexirise) or [ManabiDojo](/vs-manabidojo)",
          "**Netflix + YouTube dual subtitles** → Language Reactor (free tier) or **Lingoku** (AI + BYOK)",
          "**Power-user Anki mining** → Migaku (subscription)",
          "**AI bilingual subs + mobile app** → Trancy ([comparison](/vs-trancy))",
          "**Netflix grammar reader** → YumeGo ([vs AnimeVocab](/vs-yumego))",
          "**AI web blending + dual subs** → [Lingoku](/blog/lingoku-alternative-anime-japanese-2026) (no account)",
        ],
      },
      { type: "h2", text: "1. AnimeVocab — romaji-first, audio when subs are missing" },
      {
        type: "p",
        text: "**Platforms:** Crunchyroll, Netflix, YouTube. **Price:** free core; Pro for transcription quota. **Best for:** month-zero learners who need **romaji-first** cards and **built-in SRS** without wiring Anki. **Standout:** Listening Mode transcribes tab audio when Crunchyroll has no Japanese subtitle track — the case Jimaku overlays solve with fan `.srt` files. Open source. Hub: [learn Japanese with anime (2026)](/learn-japanese-with-anime), [Crunchyroll guide](/learn-japanese-crunchyroll).",
      },
      { type: "h2", text: "2. Lexirise — Crunchyroll-native dual subs" },
      {
        type: "p",
        text: "**Platforms:** Crunchyroll, Netflix, Prime, YouTube, Bilibili, iQIYI. **Price:** free core; Pro for SRS extras. **Best for:** learners who **read Japanese subtitles** and want click-to-translate mining on **Crunchyroll** (where Migaku and Language Reactor do not run). See [AnimeVocab vs Lexirise](/vs-lexirise).",
      },
      { type: "h2", text: "3. ManabiDojo — fan Japanese subs + quizzes" },
      {
        type: "p",
        text: "**Platforms:** Crunchyroll, Netflix (beta). **Price:** free core on Crunchyroll; premium for flashcards, AI breakdowns, web manga OCR. **Best for:** readers who want **integrated Jimaku-style subtitles**, in-player quizzes, and word popups. Pulls from jimaku.cc. Compare [vs ManabiDojo](/vs-manabidojo) and [Jimaku vs Listening Mode](/blog/jimaku-crunchyroll-subtitles-vs-listening-mode).",
      },
      { type: "h2", text: "4. Language Reactor — Netflix/YouTube dual-sub king" },
      {
        type: "p",
        text: "**Platforms:** Netflix, YouTube (not Crunchyroll). **Price:** free tier; ~$5/mo Pro. **Best for:** intermediate learners with **Japanese subtitle tracks** on Netflix. Mature dictionary, playback controls, Anki export on Pro. [AnimeVocab vs Language Reactor](/vs-language-reactor).",
      },
      { type: "h2", text: "5. Migaku — deepest mining suite" },
      {
        type: "p",
        text: "**Platforms:** Netflix, YouTube, Disney+, Viki, Animelon — **not Crunchyroll**. **Price:** ~$9/mo Standard. **Best for:** committed miners building large custom Anki decks with pitch accent and screenshots. Steep setup. [AnimeVocab vs Migaku](/vs-migaku).",
      },
      { type: "h2", text: "6. Lingoku — AI dual subs + web word blending" },
      {
        type: "p",
        text: "**Platforms:** Netflix, YouTube, Bilibili, any website. **Price:** free tier with points; BYOK for Ollama/DeepSeek/OpenAI. **Best for:** learners who read kana and want **AI contextual glosses** on dual subs plus passive vocabulary on English pages. No signup. [Lingoku vs AnimeVocab](/blog/lingoku-alternative-anime-japanese-2026).",
      },
      { type: "h2", text: "7. Trancy — AI subtitles + mobile" },
      {
        type: "p",
        text: "**Platforms:** Netflix, YouTube, mobile apps. **Price:** free tier; ~$4/mo Pro. **Best for:** learners who want **AI-generated bilingual subs** and pronunciation coaching without Anki. Overlaps Language Reactor on desktop. [AnimeVocab vs Trancy](/vs-trancy).",
      },
      { type: "h2", text: "8. YumeGo — Netflix grammar reader" },
      {
        type: "p",
        text: "**Platforms:** Netflix, Disney+, YouTube. **Price:** free with daily cap; Premium unlimited. **Best for:** readers who want **JLPT-tagged phrase saves** and grammar popups on Netflix. No Crunchyroll. [AnimeVocab vs YumeGo](/vs-yumego).",
      },
      { type: "h2", text: "What most rankings get wrong" },
      {
        type: "p",
        text: "Listicles crown **Migaku or Language Reactor** without asking: *Can you read the subtitle they require?* and *Are you on Crunchyroll?* If both answers are painful, start with **romaji + audio** ([romaji guide](/romaji-japanese-learning)) or a **Crunchyroll-native reader** (Lexirise/ManabiDojo). Graduate tools as kana clicks.",
      },
      {
        type: "p",
        text: "Decision tree post: [Migaku vs Language Reactor vs AnimeVocab for beginners](/blog/migaku-language-reactor-animevocab-beginners).",
      },
    ],
  },
  {
    slug: "jimaku-crunchyroll-subtitles-vs-listening-mode",
    title: "Jimaku Player vs Listening Mode: Crunchyroll Japanese Without Subtitle Files (2026)",
    description:
      "Crunchyroll has no Japanese subtitles. Jimaku Player and Substital overlay fan .srt files — or you transcribe audio with Listening Mode. Compare setup, legality, and what actually sticks for beginners.",
    publishedAt: "2026-07-08T10:00:00.000Z",
    updatedAt: "2026-07-08T10:00:00.000Z",
    keywords: [
      "jimaku player crunchyroll",
      "add japanese subtitles crunchyroll",
      "substital crunchyroll",
      "kitsunekko subtitles",
      "learn japanese crunchyroll no subs",
      "crunchyroll japanese subtitles extension",
    ],
    readingMinutes: 9,
    ogImage: "/slides/04-sakura-night.jpg",
    blocks: [
      {
        type: "p",
        text: "If you search **how to add Japanese subtitles to Crunchyroll**, you land in a DIY lane: download fan `.srt` files from **Kitsunekko** or **jimaku.cc**, then overlay them with **Substital**, **Jimaku Player**, or a userscript. That workflow works for intermediate learners who can **read kana**. It is painful for beginners — and brittle every time Crunchyroll changes the player DOM.",
      },
      { type: "h2", text: "The Jimaku / Substital workflow (step by step)" },
      {
        type: "ol",
        items: [
          "Find the show on **Kitsunekko** or **jimaku.cc** and download a matching `.srt` / `.ass` file.",
          "Install **Substital** (Chrome) or **Jimaku Player** (Tampermonkey userscript).",
          "Open the Crunchyroll episode, upload or auto-fetch the subtitle file.",
          "Align timing (Jimaku remembers offset per series).",
          "Click lines to look up words on Jisho — you still save vocabulary yourself.",
        ],
      },
      {
        type: "p",
        text: "Power users love this. You get real Japanese text synced to the stream. The downsides: **setup per show**, subtitle files that do not always match the Crunchyroll cut, burned-in English subs you cannot remove, and zero help if you **cannot read the script yet**.",
      },
      { type: "h2", text: "Where Listening Mode differs" },
      {
        type: "p",
        text: "**AnimeVocab Listening Mode** skips the subtitle file hunt: it transcribes **spoken Japanese from tab audio** while you keep English subtitles for plot. One **romaji-first word card** per line, built-in **spaced repetition** — no Anki wiring. It targets the Crunchyroll case where **no official JP sub track exists**, which is most simulcasts outside Japan.",
      },
      { type: "h2", text: "Honest comparison" },
      {
        type: "ul",
        items: [
          "**Can you read hiragana?** Jimaku/Substital assume yes. Listening Mode + romaji assumes not yet.",
          "**Setup time:** Jimaku = per-show file + alignment. AnimeVocab = install extension, press start.",
          "**Vocabulary retention:** Overlay tools help lookup; they do not schedule review. AnimeVocab SRS is built in.",
          "**Reliability:** Userscripts break when Crunchyroll updates. Transcription depends on audio clarity, not DOM hacks.",
          "**Cost:** Jimaku archive is free; Substital is free. AnimeVocab core is free; Pro pays for transcription quota.",
        ],
      },
      { type: "h2", text: "When to use which" },
      {
        type: "ul",
        items: [
          "**Jimaku + Substital** — you read Japanese subtitles comfortably and want full-line mining into Anki.",
          "**Lexirise / dual-sub extensions** — Crunchyroll exposes enough Japanese text for click-to-translate (see [vs Lexirise](/vs-lexirise)).",
          "**Listening Mode** — month-zero learner, romaji on-ramp, or show with **no minable JP sub track**.",
        ],
      },
      {
        type: "p",
        text: "Full Crunchyroll guide: [learn Japanese on Crunchyroll](/learn-japanese-crunchyroll). Tool ranking: [learn Japanese with anime (2026)](/learn-japanese-with-anime). Deep dive on no-sub workflows: [Crunchyroll without Japanese subs](/blog/learn-japanese-crunchyroll-no-japanese-subs).",
      },
    ],
  },
  {
    slug: "best-anime-to-learn-japanese-beginners",
    title: "Best Anime to Learn Japanese for Beginners (2026 Ranked)",
    description:
      "Ranked list of the best anime to learn Japanese for beginners — slow dialogue, everyday vocabulary, and shows to avoid when you are still on romaji.",
    publishedAt: "2026-07-05T10:00:00.000Z",
    updatedAt: "2026-07-05T10:00:00.000Z",
    keywords: [
      "best anime to learn japanese",
      "anime for japanese beginners",
      "easy japanese anime",
      "slice of life japanese learning",
    ],
    readingMinutes: 8,
    ogImage: "/slides/03-wisteria.jpg",
    canonicalPath: "/best-anime-to-learn-japanese",
    blocks: [
      {
        type: "p",
        text: "Pick the wrong show and **learn Japanese with anime** becomes frustration theater — fast slang, fantasy politics, or characters who never talk like humans. Pick the right one and you get **slow, clear dialogue** you can replay, shadow, and actually remember. This list is ranked for **beginners who still use English or romaji subtitles**, not for miners who already read kana fluently.",
      },
      { type: "h2", text: "How we ranked these shows" },
      {
        type: "ul",
        items: [
          "**Speech pace** — can you catch individual words without pausing every line?",
          "**Register** — everyday Japanese vs battle cries and archaic fantasy speech",
          "**Rewatch value** — shows you will watch twice beat novelty picks for retention",
          "**Subtitle reality** — available on Crunchyroll/Netflix with tracks you can actually use",
        ],
      },
      { type: "h2", text: "Tier 1: start here" },
      { type: "h3", text: "1. Shirokuma Cafe (Polar Bear Cafe)" },
      {
        type: "p",
        text: "The community's quiet favorite for **Japanese listening practice**. Characters speak slowly, jokes are conversational, and vocabulary skews toward daily life — ordering food, small talk, mild workplace humor. If you have ever searched **best anime to learn Japanese** on Reddit, this title appears in almost every thread for good reason.",
      },
      { type: "h3", text: "2. Non Non Biyori" },
      {
        type: "p",
        text: "Rural slice-of-life with long pauses and simple sentences. Perfect for **shadowing with anime** — repeat a line, match rhythm, move on. The emotional stakes are low so you can focus on sound instead of plot.",
      },
      { type: "h3", text: "3. Doraemon / Sazae-san (classic lane)" },
      {
        type: "p",
        text: "Older, family-friendly, and intentionally easy. Doraemon in particular shows up in Migaku and Trancy guides as a **beginner immersion** pick. Dialogue is repetitive by design — that repetition is a feature when you are building core vocabulary.",
      },
      { type: "h2", text: "Tier 2: after a month of steady input" },
      { type: "h3", text: "4. K-On!" },
      {
        type: "p",
        text: "School slang and music vocabulary, but still mostly modern Tokyo Japanese. Great once you recognize basic particles and common verbs from Tier 1 shows.",
      },
      { type: "h3", text: "5. Your Name / Weathering With You (film)" },
      {
        type: "p",
        text: "Shorter runtime, beautiful audio, emotional lines you will want to replay. Use **clip-based study** — one scene, five repetitions — instead of trying to mine an entire movie in one sitting.",
      },
      { type: "h2", text: "Shows to save for later" },
      {
        type: "ul",
        items: [
          "**Attack on Titan, Jujutsu Kaisen, Chainsaw Man** — great anime, terrible first textbooks. Shouting, jargon, and fantasy terms do not transfer to real conversation.",
          "**Historical or samurai settings** — grammar and vocabulary that sound wrong in a konbini.",
          "**Comedy with heavy Osaka dialect** — fun later; confusing when you cannot hear standard Tokyo pitch yet.",
        ],
      },
      { type: "h2", text: "The workflow that makes the list matter" },
      {
        type: "p",
        text: "A ranked list only helps if you **save vocabulary in context** and review it. Watch with English subs if you need plot clarity, but force one **deliberate word per scene** — notice it, understand it in the line, see it again tomorrow. That is the loop [AnimeVocab](/) automates on Crunchyroll and Netflix, including when **Japanese subtitle tracks are missing** ([guide](/blog/learn-japanese-crunchyroll-no-japanese-subs)). For tool comparisons see [learn Japanese with anime (2026)](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "learn-japanese-crunchyroll-no-japanese-subs",
    title: "Learn Japanese on Crunchyroll When There Are No Japanese Subtitles",
    description:
      "Crunchyroll rarely ships Japanese subtitle tracks outside Japan. Here is how to learn Japanese on Crunchyroll anyway — transcription, romaji-first tools, and what actually works in 2026.",
    publishedAt: "2026-07-05T11:00:00.000Z",
    updatedAt: "2026-07-05T11:00:00.000Z",
    keywords: [
      "learn japanese crunchyroll",
      "crunchyroll japanese subtitles",
      "migaku crunchyroll alternative",
      "crunchyroll vocabulary",
    ],
    readingMinutes: 9,
    ogImage: "/slides/05-torii-night.jpg",
    canonicalPath: "/learn-japanese-crunchyroll",
    blocks: [
      {
        type: "p",
        text: "If you searched **Migaku Crunchyroll** or **Language Reactor Crunchyroll Japanese subs**, you already hit the wall: most anime on Crunchyroll outside Japan ships with **English subtitles only**. Licensing, not laziness — Japanese studios often will not grant JP sub rights for territories where Crunchyroll cannot stream domestically. WaniKani forum threads about **Crunchyroll without subtitles** go back years; the situation has not magically fixed itself.",
      },
      { type: "h2", text: "What learners try (and where it breaks)" },
      {
        type: "ul",
        items: [
          "**English subtitles only** — your brain reads English; audio becomes background noise. Fine for entertainment, useless for acquisition.",
          "**Fan subtitle files + asbplayer** — powerful for advanced miners who already read Japanese. Not a beginner on-ramp.",
          "**Animelon** — romaji-friendly but legally gray and unreliable catalog.",
          "**VPN to Japan** — sometimes unlocks JP subs on Netflix; rarely fixes Crunchyroll's catalog the way people hope.",
        ],
      },
      { type: "h2", text: "The workaround that matches how Crunchyroll actually works" },
      {
        type: "p",
        text: "**Listen to the Japanese audio** while keeping English subs for plot if you want them. When a line matters, capture **what was said** — not what the English translator wrote. Tools differ on how they get that text:",
      },
      {
        type: "ul",
        items: [
          "**AnimeVocab Listening Mode** — transcribes spoken Japanese from the player (including Crunchyroll iframes), surfaces **one useful word per line in romaji**, and runs **spaced repetition** locally. Built for learners who cannot read kana yet.",
          "**Lexirise** — dual subtitles and click-to-translate on Crunchyroll when subtitle text exists in the DOM. Strong if you already read Japanese in subtitles.",
          "**ManabiDojo** — integrates fan/Jimaku-style Japanese subs for selected titles plus quizzes; subscription for premium features.",
        ],
      },
      { type: "h2", text: "A practical Crunchyroll session (20 minutes)" },
      {
        type: "ol",
        items: [
          "Pick a **Tier 1 beginner show** from our [best anime list](/blog/best-anime-to-learn-japanese-beginners).",
          "Enable English subs for plot if you need them — but decide you will **notice one word per scene**.",
          "When a word repeats or feels useful, save it with context (line + show title).",
          "Review for five minutes before the next episode — **SRS beats bingeing** for retention.",
        ],
      },
      { type: "h2", text: "Crunchyroll vs Netflix for Japanese learners" },
      {
        type: "p",
        text: "Netflix often has **Japanese subtitle tracks** on anime in more regions. Crunchyroll has **more simulcasts**. Many learners use both; the bottleneck is not the platform but whether you can **decode Japanese while you listen**. Compare tools in our [Crunchyroll guide](/learn-japanese-crunchyroll) and [Lexirise comparison](/vs-lexirise).",
      },
    ],
  },
  {
    slug: "spaced-repetition-anime-vocabulary",
    title: "Spaced Repetition for Anime Vocabulary: A Daily Loop That Sticks",
    description:
      "How spaced repetition (SRS) turns anime vocabulary into long-term memory — scheduling, one-word-per-line habits, and why binge watching fails without review.",
    publishedAt: "2026-07-05T12:00:00.000Z",
    updatedAt: "2026-07-05T12:00:00.000Z",
    keywords: [
      "spaced repetition japanese",
      "anime vocabulary flashcards",
      "srs japanese anime",
      "japanese immersion review",
    ],
    readingMinutes: 7,
    ogImage: "/slides/11-cards.webp",
    canonicalPath: "/anime-spaced-repetition",
    blocks: [
      {
        type: "p",
        text: "**Spaced repetition** is the difference between \"I heard that word last week\" and \"I can use that word.\" Anime gives you massive **comprehensible input**; SRS gives you **retrieval practice** so words survive the week. Migaku, Anki, WaniKani, and built-in extension decks all implement the same idea with different friction.",
      },
      { type: "h2", text: "Why binge watching alone fails" },
      {
        type: "p",
        text: "SLA research and immersion community consensus align on this: **passive exposure without recall does not build productive vocabulary**. You may feel fluent during a rewatch because context carries you — that is recognition, not recall. Reddit's r/LearnJapanese repeatedly warns that **English subtitles** make this worse because attention never lands on Japanese forms.",
      },
      { type: "h2", text: "Minimum viable SRS loop for anime learners" },
      {
        type: "ol",
        items: [
          "**Capture in context** — word + the line it appeared in + show name. Context is your mnemonic.",
          "**Review before you watch** — five minutes of due cards beats thirty minutes of new episodes.",
          "**Keep daily volume tiny** — five to ten new words per session; overflow creates Anki guilt and abandonment.",
          "**Prefer audio-forward cards** — hear the line again; anime vocabulary is listening vocabulary first.",
        ],
      },
      { type: "h2", text: "Built-in SRS vs Anki export" },
      {
        type: "p",
        text: "**Anki** remains the power-user standard (asbplayer → Anki is the classic pipeline). **Built-in SRS** wins when setup cost kills momentum — Language Reactor's light export, Migaku's full suite, or AnimeVocab's local deck tied to what you actually clicked while watching. Choose based on whether you want a **hobby** (Anki theming) or a **habit** (review in the extension popup). Deep dive: [anime spaced repetition guide](/anime-spaced-repetition).",
      },
    ],
  },
  {
    slug: "shadowing-anime-japanese-pronunciation",
    title: "Shadowing with Anime: A 15-Minute Daily Routine",
    description:
      "Use anime clips for Japanese shadowing practice — pronunciation, rhythm, and pitch without copying cartoon speech in real life.",
    publishedAt: "2026-07-05T13:00:00.000Z",
    updatedAt: "2026-07-05T13:00:00.000Z",
    keywords: [
      "japanese shadowing anime",
      "anime pronunciation practice",
      "shadowing japanese listening",
      "learn japanese speaking anime",
    ],
    readingMinutes: 6,
    ogImage: "/slides/08-final.jpg",
    blocks: [
      {
        type: "p",
        text: "**Shadowing** means playing a line and repeating it immediately — matching speed, rhythm, and intonation. Migaku's 2026 anime guide and Trancy's immersion articles both recommend it; language teachers have used the technique for decades. Anime is ideal **shadowing material** because voice actors articulate clearly compared to mumbled vlogs.",
      },
      { type: "h2", text: "The 15-minute session" },
      {
        type: "ol",
        items: [
          "Pick **one scene** (30–90 seconds) from a slow slice-of-life show.",
          "Play a single line → pause → speak aloud → replay until you match timing.",
          "Do not shadow **five episodes**; depth beats breadth.",
          "Log one new phrase into your **SRS deck** if it appeared multiple times.",
        ],
      },
      { type: "h2", text: "Cartoon speech vs real Japanese" },
      {
        type: "p",
        text: "Avoid copying **battle shouts, villain monologues, and exaggerated cute speech** into daily life. Shadow **neutral dialogue** — ordering food, asking directions, school hallway chatter. Our post on [anime Japanese vs real Japanese](/blog/anime-japanese-vs-real-japanese) covers register traps.",
      },
    ],
  },
  {
    slug: "english-subtitles-not-learning-japanese",
    title: "Why English Subtitles Don't Teach You Japanese (And What to Do Instead)",
    description:
      "English subtitles feel like study but mostly feed plot — evidence-backed alternatives for anime learners who want listening gains.",
    publishedAt: "2026-07-05T14:00:00.000Z",
    updatedAt: "2026-07-05T14:00:00.000Z",
    keywords: [
      "anime english subtitles learning",
      "passive anime watching japanese",
      "learn japanese watching anime",
      "comprehensible input anime",
    ],
    readingMinutes: 7,
    ogImage: "/slides/09-faq.jpg",
    blocks: [
      {
        type: "p",
        text: "Trancy cites that **over 60% of self-taught learners** start because of anime — yet most watch with **English subtitles** and wonder why listening does not improve. Mikey Does' SLA roundup and r/LearnJapanese threads agree: L1 subtitles capture eyeballs; L2 audio gets partial attention at best.",
      },
      { type: "h2", text: "Entertainment vs study (both are fine — pick one)" },
      {
        type: "p",
        text: "After work, English subs and zero guilt is valid. But call it **relaxing**, not **study**. Mixing the modes creates the illusion of progress — you clock hours without retrieval practice.",
      },
      { type: "h2", text: "Three upgrades that preserve fun" },
      {
        type: "ul",
        items: [
          "**One deliberate word per scene** while keeping English subs — forces attention to Japanese audio.",
          "**Japanese subtitles + lookup tool** once you read kana — dual-track immersion.",
          "**Listening Mode transcription** when JP subs do not exist — AnimeVocab's niche on [Crunchyroll](/blog/learn-japanese-crunchyroll-no-japanese-subs).",
        ],
      },
    ],
  },
  {
    slug: "anime-japanese-vs-real-japanese",
    title: "Anime Japanese vs Real Japanese: Register Traps to Avoid",
    description:
      "Anime teaches real vocabulary — but also battle cries, fantasy honorifics, and speech you should not copy at work. A practical register guide.",
    publishedAt: "2026-07-05T15:00:00.000Z",
    updatedAt: "2026-07-05T15:00:00.000Z",
    keywords: [
      "anime japanese vs real japanese",
      "japanese register anime",
      "is anime japanese useful",
      "learn japanese from anime realistic",
    ],
    readingMinutes: 8,
    ogImage: "/slides/06-manifesto.jpg",
    blocks: [
      {
        type: "p",
        text: "Wordy.info's 2026 anime guide puts it cleanly: treat anime as **listening and high-frequency phrase training**, not a script to paste into job interviews. Shonen heroes do not talk like coworkers; maids in Akihabara do not talk like your landlord.",
      },
      { type: "h2", text: "What anime teaches well" },
      {
        type: "ul",
        items: [
          "**Core verbs and adjectives** — 見る, 食べる, 楽しい appear everywhere.",
          "**Emotional intonation** — you hear how frustration, joy, and sarcasm sound.",
          "**Collocations in context** — お疲れ様, よろしく, 大丈夫 land with scene memory.",
        ],
      },
      { type: "h2", text: "What to filter out" },
      {
        type: "ul",
        items: [
          "**Fantasy suffixes and archaisms** — 〜ぞ, 汝, feudal copula in isekai.",
          "**Over-cute speech patterns** — fine in roleplay, odd in a bank.",
          "**Shouting as default** — volume ≠ fluency.",
        ],
      },
      {
        type: "p",
        text: "Slice-of-life shows (see [best anime for beginners](/blog/best-anime-to-learn-japanese-beginners)) skew closer to **real-world register**. Pair anime input with a textbook or tutor for **polite forms** — tools like AnimeVocab still help because they anchor words to **specific lines you can judge for register**.",
      },
    ],
  },
  {
    slug: "romaji-first-japanese-anime",
    title: "Romaji-First Japanese Learning: When It Helps and When to Switch",
    description:
      "Romaji is not cheating — for anime beginners it lowers friction so you notice spoken words before kanji walls. When to move to kana and how tools differ.",
    publishedAt: "2026-07-05T16:00:00.000Z",
    updatedAt: "2026-07-05T16:00:00.000Z",
    keywords: [
      "romaji japanese learning",
      "learn japanese without kanji",
      "romaji anime vocabulary",
      "beginner japanese anime",
    ],
    readingMinutes: 6,
    ogImage: "/slides/04-fireflies.jpg",
    canonicalPath: "/romaji-japanese-learning",
    blocks: [
      {
        type: "p",
        text: "Most **learn Japanese with anime** tools assume you read **hiragana at minimum**. Language Reactor, asbplayer, Migaku, and Yomitan are built for people who already parse Japanese text in subtitles. **Romaji-first** tools exist because that assumption excludes the largest cohort — fans who hear Japanese clearly but cannot read it yet.",
      },
      { type: "h2", text: "When romaji-first wins" },
      {
        type: "ul",
        items: [
          "You are in month zero — kana course not finished but you still watch weekly simulcasts.",
          "Crunchyroll gives you **audio without JP subs** — romaji bridges speech to meaning.",
          "You want **one word per line**, not a 40-field Anki card.",
        ],
      },
      { type: "h2", text: "When to add kana" },
      {
        type: "p",
        text: "Once you recognize ~50 words by sound, **hiragana unlocks dictionaries and miners**. Animelon and Netflix JP subs become usable. AnimeVocab stays useful because the underlying words transfer — only the display layer changes. Full guide: [romaji Japanese learning](/romaji-japanese-learning).",
      },
    ],
  },
  {
    slug: "learn-japanese-netflix-anime-2026",
    title: "Learn Japanese on Netflix Anime in 2026: Subtitles, Tools, Workflow",
    description:
      "Netflix often has Japanese subtitle tracks on anime — how to use dual subtitles, avoid CC traps, and build vocabulary with spaced repetition.",
    publishedAt: "2026-07-05T17:00:00.000Z",
    updatedAt: "2026-07-05T17:00:00.000Z",
    keywords: [
      "learn japanese netflix anime",
      "netflix japanese subtitles anime",
      "netflix dual subtitles japanese",
      "language reactor netflix",
    ],
    readingMinutes: 8,
    ogImage: "/slides/05-private.jpg",
    canonicalPath: "/learn-japanese-netflix-anime",
    blocks: [
      {
        type: "p",
        text: "Linglass' 2026 workflow guide notes Netflix is often **better than Crunchyroll for Japanese subtitle availability** — especially on JP Netflix or US titles with standard JP sub tracks. The catch: you must verify **Japanese** subs, not **CC closed captions** only, and you still need a loop that saves words.",
      },
      { type: "h2", text: "Check your subtitle track" },
      {
        type: "ul",
        items: [
          "**Standard Japanese** — dialogue as spoken; best for reading while listening.",
          "**(CC) Japanese** — often verbatim but includes SFX text; still usable.",
          "**English only** — treat like Crunchyroll: audio-first tools or dual-overlay extensions.",
        ],
      },
      { type: "h2", text: "Tool fit on Netflix" },
      {
        type: "ul",
        items: [
          "**Language Reactor** — dual subs + dictionary; intermediate+.",
          "**HASHIGO!** — furigana and JLPT coloring on Netflix.",
          "**AnimeVocab** — romaji cards + Listening Mode when subs are missing or you skip reading.",
          "**asbplayer** — mining with external sub files; advanced.",
        ],
      },
      {
        type: "p",
        text: "Reader stack deep dive: [HASHIGO, Yomitan & Netflix](/blog/hashigo-yomitan-netflix-japanese-anime-2026). Compare Netflix vs Crunchyroll workflows in our [Netflix anime guide](/learn-japanese-netflix-anime) and [master tool ranking](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "migaku-language-reactor-animevocab-beginners",
    title: "Migaku vs Language Reactor vs AnimeVocab: Which for Beginners?",
    description:
      "Decision tree for anime learners picking Migaku, Language Reactor, or AnimeVocab — based on reading level, platform, and tolerance for setup.",
    publishedAt: "2026-07-05T18:00:00.000Z",
    updatedAt: "2026-07-05T18:00:00.000Z",
    keywords: [
      "migaku vs language reactor",
      "animevocab vs migaku",
      "best chrome extension learn japanese anime",
      "beginner japanese immersion tool",
    ],
    readingMinutes: 7,
    ogImage: "/slides/07-pricing.jpg",
    blocks: [
      {
        type: "p",
        text: "These three names dominate **learn Japanese from anime** searches — but they serve different skill bands. Migaku is a **power-user mining suite**. Language Reactor is a **dual-subtitle reader**. AnimeVocab is a **romaji-first on-ramp with Listening Mode** when JP subs or reading skill are missing.",
      },
      { type: "h2", text: "Pick AnimeVocab if…" },
      {
        type: "ul",
        items: [
          "You **cannot read kana** comfortably yet.",
          "You watch **Crunchyroll simulcasts** without Japanese subtitles.",
          "You want **built-in SRS** without configuring Anki.",
        ],
      },
      { type: "h2", text: "Pick Language Reactor if…" },
      {
        type: "ul",
        items: [
          "You read **hiragana/katakana** and want Netflix/YouTube dual subs.",
          "You are okay exporting to Anki for heavy review.",
        ],
      },
      { type: "h2", text: "Pick Migaku if…" },
      {
        type: "ul",
        items: [
          "You want **sentence mining** into a deep SRS with mobile sync.",
          "You will invest setup time and **$9/mo** (or lifetime).",
          "You mostly mine YouTube/Netflix — not Crunchyroll-native workflows.",
        ],
      },
      {
        type: "p",
        text: "Side-by-side pages: [vs Language Reactor](/vs-language-reactor), [vs Migaku](/vs-migaku), [full 2026 ranking](/learn-japanese-with-anime).",
      },
    ],
  },
  {
    slug: "one-word-per-episode-method",
    title: "The One-Word-Per-Episode Method (Why Less Beats More)",
    description:
      "Save one useful anime vocabulary word per episode, review daily, and compound — the anti-binge strategy that actually builds Japanese.",
    publishedAt: "2026-07-05T19:00:00.000Z",
    updatedAt: "2026-07-05T19:00:00.000Z",
    keywords: [
      "anime vocabulary method",
      "learn one word per day japanese",
      "japanese vocabulary retention anime",
      "anime study habit",
    ],
    readingMinutes: 5,
    ogImage: "/slides/10-coach.webp",
    blocks: [
      {
        type: "p",
        text: "Wordy.info and Linglass both argue for **small, repeated clips** over marathon sessions. The one-word-per-episode rule is the binge-watcher's rehab program: you still watch the full episode for fun, but you **promote exactly one line to long-term memory**.",
      },
      { type: "h2", text: "How to choose the word" },
      {
        type: "ul",
        items: [
          "It appeared **more than once** in the episode.",
          "It is **useful outside anime** — food, feelings, time, movement.",
          "You can **hear it clearly** — not mumbled background chatter.",
        ],
      },
      { type: "h2", text: "Why tools matter" },
      {
        type: "p",
        text: "Manual note-taking dies after three episodes. Extensions that attach **line + audio + review scheduling** remove friction — that is why AnimeVocab caps cards at **one candidate per subtitle line** instead of flooding you. Pair with [spaced repetition](/blog/spaced-repetition-anime-vocabulary) and [beginner anime picks](/blog/best-anime-to-learn-japanese-beginners).",
      },
    ],
  },
  {
    slug: "ai-manga-maker-free-online-2026",
    title: "AI Manga Maker Free Online (2026): How Manga Studio Works",
    description:
      "Create manga online free with AI — full chapters from a text premise, editable dialogue, per-panel redraw, and sketch beautify. How AnimeVocab Manga Studio compares to other generators.",
    publishedAt: "2026-07-07T08:00:00.000Z",
    updatedAt: "2026-07-07T08:00:00.000Z",
    keywords: [
      "ai manga maker free",
      "create manga online free",
      "ai manga generator",
      "manga maker online",
      "make manga with ai",
    ],
    readingMinutes: 9,
    ogImage: "/slides/12-manga.webp",
    canonicalPath: "/ai-manga-maker",
    blocks: [
      {
        type: "p",
        text: "Search **ai manga maker** or **create manga online free** and you get a dozen tools that output one pretty image with garbled speech-bubble text. **Manga Studio** at [animevocab.com/studio](/studio) takes a different path: AI drafts a **full chapter** (cast, panels, dialogue), but **text lives in the reader** — editable, legible in Japanese, never baked into pixels.",
      },
      { type: "h2", text: "What you get from one premise" },
      {
        type: "ul",
        items: [
          "**Title and logline** — genre, tone, setting from your prompt",
          "**Recurring cast** — character look descriptions kept consistent across panels",
          "**Panel scripts** — visual scene beat + dialogue lines (speech, thought, narration, SFX)",
          "**One image per panel** — redraw panel 3 without regenerating the whole page",
        ],
      },
      { type: "h2", text: "The three things most AI manga generators get wrong" },
      {
        type: "ol",
        items: [
          "**Text baked into art** — Japanese kanji garbles; English cannot be edited after generation.",
          "**Single grid image** — one mistake means redoing everything.",
          "**No story structure** — one splash page, not a readable chapter with pacing.",
        ],
      },
      { type: "h2", text: "Sketch → AI redraw" },
      {
        type: "p",
        text: "Open the sketch pad on any panel, draw a rough composition, and the image model redraws it in your chosen **manga art style**. This is the workflow Clip Studio users know — storyboard first, ink second — without owning a tablet.",
      },
      { type: "h2", text: "Free tier and publishing" },
      {
        type: "p",
        text: "Try without an account — one manga held in your browser. Sign in (free) to save, publish to the [public gallery](/gallery), and share at `/m/your-id`. Full comparison table: [AI manga maker guide](/ai-manga-maker). For Japanese learners: [learn Japanese with manga](/learn-japanese-manga).",
      },
    ],
  },
  {
    slug: "learn-japanese-by-writing-manga",
    title: "Learn Japanese by Writing Manga: Active Recall for Anime Fans",
    description:
      "Why writing short manga chapters beats only reading them for vocabulary retention — a practical workflow with Manga Studio and spaced repetition from anime.",
    publishedAt: "2026-07-07T09:00:00.000Z",
    updatedAt: "2026-07-07T09:00:00.000Z",
    keywords: [
      "learn japanese with manga",
      "write manga learn japanese",
      "japanese active recall",
      "manga vocabulary practice",
    ],
    readingMinutes: 7,
    ogImage: "/slides/12-manga.webp",
    canonicalPath: "/learn-japanese-manga",
    blocks: [
      {
        type: "p",
        text: "Immersion communities obsess over **input** — anime, manga, podcasts. Output gets deferred until you can already speak. But **retrieval practice** (producing words from memory) is what moves vocabulary from passive recognition to usable recall. Writing a four-panel manga where your OC says お腹が空いた is harder than reading it — and that difficulty is the point.",
      },
      { type: "h2", text: "The write → read → check loop" },
      {
        type: "ol",
        items: [
          "Pick 3–5 target words from anime watching ([one word per episode method](/blog/one-word-per-episode-method)).",
          "Draft a manga chapter in [Manga Studio](/studio) using those words in dialogue.",
          "Edit every AI-generated line until it sounds like something a human would say.",
          "Read aloud — shadow your own lines for pronunciation.",
          "Pass the word check for XP; add failed words to your extension SRS deck.",
        ],
      },
      { type: "h2", text: "Month zero: romaji and English bridges" },
      {
        type: "p",
        text: "You do not need N3 grammar to start. Write in English, translate line-by-line, or use romaji display while you learn kana. Same on-ramp as [romaji-first learning](/romaji-japanese-learning). The manga is yours — embarrassment-free practice.",
      },
      {
        type: "p",
        text: "Full guide: [learn Japanese with manga](/learn-japanese-manga). Pair with [best beginner anime](/blog/best-anime-to-learn-japanese-beginners) for listening input.",
      },
    ],
  },
  {
    slug: "animelon-alternative-anime-japanese-2026",
    title: "Animelon Alternative (2026): Romaji Anime with Legal Workflows",
    description:
      "Animelon offered romaji-friendly anime subtitles but is unreliable. Modern alternatives for learning Japanese from anime — Netflix, YouTube, Crunchyroll, and Listening Mode.",
    publishedAt: "2026-07-07T10:00:00.000Z",
    updatedAt: "2026-07-07T10:00:00.000Z",
    keywords: [
      "animelon alternative",
      "animelon replacement",
      "romaji anime subtitles",
      "learn japanese anime streaming",
    ],
    readingMinutes: 8,
    ogImage: "/slides/06-manifesto.jpg",
    canonicalPath: "/vs-animelon",
    blocks: [
      {
        type: "p",
        text: "**Animelon** was the romaji learner's secret — synced Japanese dialogue with word-by-word hover translations. Catalog gaps, downtime, and legal gray areas pushed learners back to Netflix, YouTube, and Crunchyroll. If you searched **Animelon alternative** in 2026, here is what actually replaces it by use case. Full comparison: [AnimeVocab vs Animelon](/vs-animelon).",
      },
      { type: "h2", text: "If you need romaji without reading kana" },
      {
        type: "ul",
        items: [
          "**AnimeVocab** — romaji-first cards from spoken dialogue; Listening Mode when JP subs are missing on Crunchyroll.",
          "**Animelon** (when up) — still useful for specific titles; do not depend on it as primary pipeline.",
        ],
      },
      { type: "h2", text: "If you read hiragana and want dual subtitles" },
      {
        type: "ul",
        items: [
          "**Language Reactor** — Netflix/YouTube dual subs + dictionary.",
          "**Lexirise** — Crunchyroll click-to-translate when subtitle text exists.",
          "**HASHIGO!** — furigana and JLPT coloring on Netflix.",
        ],
      },
      { type: "h2", text: "If you mine into Anki" },
      {
        type: "p",
        text: "**asbplayer** + fan subs remains the power-user path. High setup, maximum control. Compare [Migaku vs Language Reactor vs AnimeVocab](/blog/migaku-language-reactor-animevocab-beginners) for where to start.",
      },
      {
        type: "p",
        text: "Crunchyroll-specific: [learn Japanese without JP subs](/blog/learn-japanese-crunchyroll-no-japanese-subs). YouTube: [learn Japanese on YouTube anime](/learn-japanese-youtube-anime).",
      },
    ],
  },
  {
    slug: "ai-manga-generator-comparison-2026",
    title: "Best AI Manga Generator (2026): Manga Studio vs Manga AI vs Comicory",
    description:
      "Honest comparison of AI manga generators — editable dialogue, panel redraw, character consistency, pricing, and which tool fits storytellers vs learners.",
    publishedAt: "2026-07-07T11:00:00.000Z",
    updatedAt: "2026-07-07T11:00:00.000Z",
    keywords: [
      "best ai manga generator",
      "ai manga generator comparison",
      "manga ai vs manga maker",
      "comicory vs manga studio",
    ],
    readingMinutes: 10,
    ogImage: "/slides/12-manga.webp",
    blocks: [
      {
        type: "p",
        text: "The **AI manga generator** space exploded in 2025–2026: MangaMaker.com, Manga AI, Comicory, Anifusion, and niche web apps all promise pages in minutes. They optimize for different jobs — photo-to-manga, shounen splash art, webtoon layout. Here is how **AnimeVocab Manga Studio** fits if you care about **editable stories** and optional **Japanese learning**.",
      },
      { type: "h2", text: "Comparison at a glance" },
      {
        type: "ul",
        items: [
          "**Manga Studio** — chapter drafts, per-panel art, editable bubble text, sketch redraw, free gallery, JP learning hooks.",
          "**MangaMaker.com** — fast photo-to-character manga, 12 styles, credit packs.",
          "**Manga AI** — polished B&W pages, animation export, 14 styles.",
          "**Comicory** — strong layout picker, character library, monochrome screentone focus.",
          "**Anifusion** — LoRA training, multi-panel canvas, webtoon + manga modes.",
        ],
      },
      { type: "h2", text: "Pick Manga Studio if…" },
      {
        type: "ul",
        items: [
          "You want to **rewrite dialogue** after generation.",
          "You need **Japanese text** that stays legible (not baked into art).",
          "You are an **anime learner** weaving vocab into stories.",
          "You want a **public gallery** without a separate hosting step.",
        ],
      },
      { type: "h2", text: "Pick a general generator if…" },
      {
        type: "ul",
        items: [
          "You need **photo upload** as the primary character input.",
          "You want **animated cuts** from finished pages (Manga AI).",
          "You are building **webtoons** with vertical scroll (Anifusion).",
        ],
      },
      {
        type: "p",
        text: "Full feature table and FAQ: [AI manga maker guide](/ai-manga-maker). Browse published work: [Manga Gallery](/gallery). Try Studio: [/studio](/studio).",
      },
    ],
  },
  {
    slug: "learn-japanese-youtube-anime-subtitles",
    title: "Learn Japanese on YouTube Anime: Hidden JP Subs and Tools (2026)",
    description:
      "YouTube anime often has a hidden Japanese caption track. How to enable it, pair with romaji tools, and build vocabulary with spaced repetition.",
    publishedAt: "2026-07-07T12:00:00.000Z",
    updatedAt: "2026-07-07T12:00:00.000Z",
    keywords: [
      "learn japanese youtube anime",
      "youtube japanese subtitles anime",
      "youtube anime vocabulary",
      "language reactor youtube",
    ],
    readingMinutes: 8,
    ogImage: "/slides/04-fireflies.jpg",
    canonicalPath: "/learn-japanese-youtube-anime",
    blocks: [
      {
        type: "p",
        text: "Official **YouTube anime** uploads frequently include a **Japanese caption track** separate from auto-generated English. AnimeVocab reads that track even while you display English subs — the same trick Language Reactor uses for dual-sub workflows, but with **romaji-first cards** for beginners.",
      },
      { type: "h2", text: "Enable Japanese captions on YouTube" },
      {
        type: "ol",
        items: [
          "Open Settings (gear) → Subtitles/CC.",
          "Pick **Japanese** (not auto-translate).",
          "If only English appears, the uploader may not have JP — try another source or Listening Mode.",
        ],
      },
      { type: "h2", text: "Tool fit on YouTube" },
      {
        type: "ul",
        items: [
          "**AnimeVocab** — JP track parsing + romaji cards + local SRS; works on official channels.",
          "**Language Reactor** — dual subs + dictionary; best if you read kana.",
          "**Migaku** — sentence mining to Anki; power-user setup.",
        ],
      },
      { type: "h2", text: "YouTube vs Netflix vs Crunchyroll" },
      {
        type: "p",
        text: "YouTube wins on **free catalog** and often on **JP caption availability**. Netflix wins on **simulcast quality** and dual-sub extensions. Crunchyroll wins on **new releases** but often lacks JP subs — see [Crunchyroll without JP subs](/blog/learn-japanese-crunchyroll-no-japanese-subs). Master comparison: [learn Japanese with anime](/learn-japanese-with-anime). Landing page: [YouTube anime guide](/learn-japanese-youtube-anime).",
      },
    ],
  },
  {
    slug: "japanese-vocabulary-anime-beginners-guide",
    title: "Japanese Vocabulary from Anime: A Beginner's Capture Guide (2026)",
    description:
      "How to build Japanese vocabulary from anime without drowning in flashcards — frequency, context, romaji on-ramp, and daily review habits.",
    publishedAt: "2026-07-07T13:00:00.000Z",
    updatedAt: "2026-07-07T13:00:00.000Z",
    keywords: [
      "japanese vocabulary from anime",
      "anime vocabulary list",
      "learn japanese words from anime",
      "anime flashcards japanese",
    ],
    readingMinutes: 8,
    ogImage: "/slides/11-cards.webp",
    blocks: [
      {
        type: "p",
        text: "**Japanese vocabulary from anime** is high-frequency spoken Japanese — not textbook polite forms, not newspaper keigo. The trick is capturing **useful** words in **context** and reviewing on a schedule. Random word lists from Google fail because they lack the line you heard and the show that anchored the memory.",
      },
      { type: "h2", text: "What to capture (and what to skip)" },
      {
        type: "ul",
        items: [
          "**Capture** — verbs/adjectives you hear twice, emotional phrases, daily-life nouns (food, weather, school).",
          "**Skip** — attack names, fantasy ranks, one-off insults you will never say.",
          "**Defer** — keigo and dialect until standard Tokyo speech feels automatic.",
        ],
      },
      { type: "h2", text: "Romaji → kana → kanji path" },
      {
        type: "p",
        text: "Month zero learners should see **romaji + meaning + audio** first. Once kana clicks, the same deck displays hiragana. AnimeVocab, Animelon-style sites, and Netflix JP subs meet you at different stages — see [romaji-first guide](/blog/romaji-first-japanese-anime).",
      },
      { type: "h2", text: "Daily habit stack" },
      {
        type: "ol",
        items: [
          "5 min SRS review before watching.",
          "One episode with **one deliberate word** ([method](/blog/one-word-per-episode-method)).",
          "Optional: write a 4-panel manga using today's word in [Manga Studio](/studio).",
        ],
      },
      {
        type: "p",
        text: "SRS deep dive: [spaced repetition for anime vocab](/blog/spaced-repetition-anime-vocabulary). Show picks: [best anime for beginners](/blog/best-anime-to-learn-japanese-beginners).",
      },
    ],
  },
  {
    slug: "trancy-alternative-anime-japanese-2026",
    title: "Trancy Alternative for Learning Japanese from Anime (2026)",
    description:
      "Trancy offers dual subtitles and AI features on Netflix and YouTube. How it compares to AnimeVocab for beginners, romaji learners, and Crunchyroll watching.",
    publishedAt: "2026-07-07T14:00:00.000Z",
    updatedAt: "2026-07-07T14:00:00.000Z",
    keywords: [
      "trancy alternative",
      "trancy vs animevocab",
      "trancy japanese learning",
      "dual subtitle anime extension",
    ],
    readingMinutes: 7,
    ogImage: "/slides/05-private.jpg",
    canonicalPath: "/vs-trancy",
    blocks: [
      {
        type: "p",
        text: "**Trancy** (formerly Language Reactor's competitor lane) targets Netflix/YouTube with dual subtitles, vocabulary lists, and AI-assisted study. Learners searching **Trancy alternative** usually want either **lower price**, **Crunchyroll support**, or **romaji for beginners**. Side-by-side page: [AnimeVocab vs Trancy](/vs-trancy).",
      },
      { type: "h2", text: "Where Trancy wins" },
      {
        type: "ul",
        items: [
          "Polished dual-sub UI on **Netflix and YouTube**.",
          "Integrated vocabulary notebook and AI explanations.",
          "Strong if you already **read Japanese subtitles**.",
        ],
      },
      { type: "h2", text: "Where AnimeVocab wins" },
      {
        type: "ul",
        items: [
          "**Romaji-first** cards — no kana prerequisite.",
          "**Listening Mode** — transcribes spoken Japanese when JP subs are missing (Crunchyroll).",
          "**Local-first** — progress in browser storage; no account required for core loop.",
          "**Open source** extension + free [Manga Studio](/studio) for output practice.",
        ],
      },
      {
        type: "p",
        text: "Full tool ranking: [learn Japanese with anime (2026)](/learn-japanese-with-anime). Trancy blog alignment: [shadowing with anime](/blog/shadowing-anime-japanese-pronunciation).",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}

function keywordOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((k) => k.toLowerCase()));
  return a.filter((k) => setB.has(k.toLowerCase())).length;
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = getBlogPost(slug);
  if (!current) return blogPosts.filter((p) => p.slug !== slug).slice(0, limit);

  return [...blogPosts]
    .filter((p) => p.slug !== slug)
    .sort((a, b) => keywordOverlap(b.keywords, current.keywords) - keywordOverlap(a.keywords, current.keywords))
    .slice(0, limit);
}
