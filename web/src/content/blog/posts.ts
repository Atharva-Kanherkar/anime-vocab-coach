import type { BlogPost } from "./types";

export const blogPosts: BlogPost[] = [
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
        text: "Compare Netflix vs Crunchyroll workflows in our [Netflix anime guide](/learn-japanese-netflix-anime) and [master tool ranking](/learn-japanese-with-anime).",
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
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}

export function getAllBlogSlugs(): string[] {
  return blogPosts.map((p) => p.slug);
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  return blogPosts.filter((p) => p.slug !== slug).slice(0, limit);
}
