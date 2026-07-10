// Choose-Your-Ending — fan-art epilogues for famous manga/anime.
// Framed as fandom creative play (fan endings / fan art), not official releases.

import type { StyleKey } from "@/lib/cards";
import type { StudioCastMember } from "@/lib/studio";

export interface EndingChoice {
  id: string;
  title: string;
  blurb: string;
  premiseBeat: string;
  tone: string;
}

export interface FeaturedEndingManga {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  synopsis: string;
  cliffhanger: string;
  genre: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
  cast: StudioCastMember[];
  endings: EndingChoice[];
  accent: string;
}

function paths(
  a: EndingChoice,
  b: EndingChoice,
  c: EndingChoice
): EndingChoice[] {
  return [a, b, c];
}

export const ENDING_CATALOG: FeaturedEndingManga[] = [
  {
    id: "lantern-of-words",
    title: "The Lantern of Words",
    subtitle: "言葉の灯",
    tag: "Original",
    synopsis:
      "Sixty keepers restored the silence between words. Mu has a name again. One distant thread still hums.",
    cliffhanger: "The war is over. One strand still hums. How does yours end?",
    genre: "Fantasy adventure",
    setting: "Bhimbetka rock shelters at dusk",
    language: "English",
    styleKey: "spirit",
    accent: "#c4a574",
    cast: [
      { name: "Sen", look: "slight teen in a dark windbreaker, face never fully shown, quiet resolve" },
      { name: "Mu", look: "small quiet person-shaped figure in soft ink, keeper of pauses, gentle" },
      { name: "Pip", look: "tiny girl in an oversized coat, empathetic bright eyes" },
      { name: "Rafa", look: "small cheerful boy, always waving, fearless friendliness" },
    ],
    endings: paths(
      {
        id: "reunion",
        title: "Bittersweet reunion",
        blurb: "The humming strand is a lost word coming home.",
        tone: "Heartfelt",
        premiseBeat:
          "Fan ending: the distant strand is a lost word returning. Sen, Mu, Pip, Rafa follow it to a quiet reunion. Bittersweet, hopeful.",
      },
      {
        id: "comedy",
        title: "Chaotic twist",
        blurb: "A snack gremlin eats the strand. Reality improvises.",
        tone: "Comedic",
        premiseBeat:
          "Fan ending: Mochi chomps the cosmic strand. Slapstick scramble, warm finish.",
      },
      {
        id: "quiet",
        title: "Quiet morning",
        blurb: "Soup, notebooks, the first ordinary day after.",
        tone: "Wholesome",
        premiseBeat:
          "Fan ending: slice-of-life campfire soup. Mu practices their name. Soft earned peace.",
      }
    ),
  },
  {
    id: "one-piece",
    title: "One Piece",
    subtitle: "ワンピース",
    tag: "Shonen",
    synopsis:
      "The Straw Hats reached Laugh Tale. The treasure is real — and so is the morning after. The sea is quiet for the first time in years.",
    cliffhanger: "Laugh Tale is behind them. What is the first ordinary day?",
    genre: "Adventure",
    setting: "A quiet island dock at sunrise after the final voyage",
    language: "English",
    styleKey: "slayer",
    accent: "#e8a54b",
    cast: [
      { name: "Luffy", look: "Monkey D. Luffy — straw hat, scar under left eye, red vest, huge grin, stretchy pirate captain energy, Eiichiro Oda One Piece art style" },
      { name: "Zoro", look: "Roronoa Zoro — green hair, three swords, bandana, calm sharp swordsman, One Piece style" },
      { name: "Nami", look: "Nami — orange hair, confident navigator, map case, One Piece style" },
      { name: "Sanji", look: "Sanji — blond cook, suit pants and shirt, curled eyebrow, cool, One Piece style" },
    ],
    endings: paths(
      {
        id: "family",
        title: "Found family forever",
        blurb: "They stay together — new seas, same table.",
        tone: "Heartfelt",
        premiseBeat:
          "One Piece fan ending / fan art epilogue: after Laugh Tale, the crew keeps sailing as family. Feast, vows, open horizon. Match classic One Piece character designs and vibe.",
      },
      {
        id: "scatter",
        title: "Everyone goes home",
        blurb: "They scatter — letters across the sea.",
        tone: "Bittersweet",
        premiseBeat:
          "One Piece fan ending: crew parts at the dock with laughter and tears. Letters, new dreams, one last shared meal. Classic character looks.",
      },
      {
        id: "next",
        title: "The next captain",
        blurb: "A kid from the island asks to join.",
        tone: "Hopeful",
        premiseBeat:
          "One Piece fan ending: a local kid asks to sail; Luffy says yes. New beginning, comedy + heart. Classic designs.",
      }
    ),
  },
  {
    id: "naruto",
    title: "Naruto",
    subtitle: "ナルト",
    tag: "Shonen",
    synopsis:
      "The village is at peace. The loudest ninja finally sits still long enough to hear the wind in the leaves.",
    cliffhanger: "Peace holds. What does he protect when there is no war?",
    genre: "Action drama",
    setting: "Konoha rooftops at dusk",
    language: "English",
    styleKey: "slayer",
    accent: "#f0a020",
    cast: [
      { name: "Naruto", look: "Naruto Uzumaki — blond spiky hair, whisker marks, orange jacket, warm grin, Kishimoto Naruto style" },
      { name: "Sasuke", look: "Sasuke Uchiha — dark hair, cool distant eyes, dark cloak, Naruto style" },
      { name: "Sakura", look: "Sakura Haruno — pink hair, strong medical ninja, Naruto style" },
      { name: "Kakashi", look: "Kakashi Hatake — silver hair, mask, one visible eye, relaxed, Naruto style" },
    ],
    endings: paths(
      {
        id: "hokage",
        title: "Hokage morning",
        blurb: "First day on the job — ramen optional.",
        tone: "Wholesome",
        premiseBeat:
          "Naruto fan ending: first morning as Hokage. Bureaucracy comedy, soft pride, friends dropping by. Classic character designs.",
      },
      {
        id: "team7",
        title: "Team 7 reunion",
        blurb: "One mission. No stakes. Just them.",
        tone: "Heartfelt",
        premiseBeat:
          "Naruto fan ending: Team 7 tiny pointless mission for old times. Banter, softened rivalry. Classic looks.",
      },
      {
        id: "letter",
        title: "Letter to the past",
        blurb: "He writes to the orphan he used to be.",
        tone: "Dramatic",
        premiseBeat:
          "Naruto fan ending: rooftop letter to younger self. Emotional, minimal action. Classic designs.",
      }
    ),
  },
  {
    id: "demon-slayer",
    title: "Demon Slayer",
    subtitle: "鬼滅の刃",
    tag: "Shonen",
    synopsis:
      "The last night of the Corps. Dawn arrives without a battle. Someone is making breakfast like the world did not almost end.",
    cliffhanger: "Demons are gone. What do they do with their hands?",
    genre: "Historical fantasy",
    setting: "Countryside house at dawn",
    language: "English",
    styleKey: "slayer",
    accent: "#6b8f71",
    cast: [
      { name: "Tanjiro", look: "Tanjiro Kamado — checkered haori, scarred forehead, kind eyes, Demon Slayer anime style" },
      { name: "Nezuko", look: "Nezuko Kamado — after bamboo era, soft pink eyes, growing into peace, Demon Slayer style" },
      { name: "Zenitsu", look: "Zenitsu Agatsuma — blond, dramatic expressions, soft courage, Demon Slayer style" },
      { name: "Inosuke", look: "Inosuke Hashibira — boar mask optional, wild and loyal, Demon Slayer style" },
    ],
    endings: paths(
      {
        id: "dawn",
        title: "Ordinary dawn",
        blurb: "Farm work. Soft laughter. No blood.",
        tone: "Wholesome",
        premiseBeat:
          "Demon Slayer fan ending / fan art: first peaceful morning. Chores, food, siblings safe. Match official character designs closely.",
      },
      {
        id: "graves",
        title: "Visit the graves",
        blurb: "They thank the ones who did not make it.",
        tone: "Heartfelt",
        premiseBeat:
          "Demon Slayer fan ending: mountain graves, incense, promises to live well. Classic looks.",
      },
      {
        id: "teach",
        title: "Training kids",
        blurb: "They teach breathing — for health, not war.",
        tone: "Hopeful",
        premiseBeat:
          "Demon Slayer fan ending: teaching village kids breathing as sport. Comedy + warmth. Classic designs.",
      }
    ),
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    subtitle: "呪術廻戦",
    tag: "Shonen",
    synopsis:
      "The curses quiet down. The school still stands. Someone leaves a convenience-store snack on a desk that used to be empty.",
    cliffhanger: "Survivors inherit the silence. What do they build?",
    genre: "Dark fantasy",
    setting: "Tokyo Jujutsu High after the last battle",
    language: "English",
    styleKey: "shadow",
    accent: "#8b6bb5",
    cast: [
      { name: "Yuji", look: "Yuji Itadori — spiky pink hair, kind eyes, black uniform, Jujutsu Kaisen style" },
      { name: "Megumi", look: "Megumi Fushiguro — dark spiky hair, stoic, JJK style" },
      { name: "Nobara", look: "Nobara Kugisaki — short brown hair, confident smirk, JJK style" },
      { name: "Gojo", look: "Satoru Gojo — white hair, blindfold/sunglasses, tall, playful, JJK style" },
    ],
    endings: paths(
      {
        id: "photo",
        title: "Class photo",
        blurb: "They force a smile. It becomes real.",
        tone: "Bittersweet",
        premiseBeat:
          "Jujutsu Kaisen fan ending: survivors take a class photo. Humor covering grief, then warmth. Exact character vibes.",
      },
      {
        id: "teachers",
        title: "New first-years",
        blurb: "They become the teachers they needed.",
        tone: "Hopeful",
        premiseBeat:
          "JJK fan ending: teaching nervous first-years. Mentorship comedy. Classic designs.",
      },
      {
        id: "normal",
        title: "One normal day",
        blurb: "Arcade. Ramen. No curses.",
        tone: "Wholesome",
        premiseBeat:
          "JJK fan ending: deliberately boring perfect day. Friendship focus. Classic looks.",
      }
    ),
  },
  {
    id: "attack-on-titan",
    title: "Attack on Titan",
    subtitle: "進撃の巨人",
    tag: "Seinen",
    synopsis:
      "The walls are history. Birds cross a sky that used to be forbidden. Someone plants a tree where a battlefield was.",
    cliffhanger: "Freedom arrived. What do they do with it?",
    genre: "Dark drama",
    setting: "A rebuilt town beyond the old walls",
    language: "English",
    styleKey: "shadow",
    accent: "#a65d4a",
    cast: [
      { name: "Eren", look: "Eren Yeager — long dark hair tied back, intense eyes, worn cloak, Attack on Titan style" },
      { name: "Mikasa", look: "Mikasa Ackerman — short black hair, red scarf, protective strength, AoT style" },
      { name: "Armin", look: "Armin Arlert — blond, thoughtful, hopeful eyes, AoT style" },
    ],
    endings: paths(
      {
        id: "sea",
        title: "The sea again",
        blurb: "They finally walk the shore without war.",
        tone: "Heartfelt",
        premiseBeat:
          "Attack on Titan fan ending: friends at the sea, quiet wonder, no titans. Classic designs.",
      },
      {
        id: "rebuild",
        title: "Rebuild",
        blurb: "Bricks, bread, a school.",
        tone: "Hopeful",
        premiseBeat:
          "AoT fan ending: rebuilding a town. Labor, community, small joys. Classic looks.",
      },
      {
        id: "letter",
        title: "Letter unsent",
        blurb: "Someone writes what they could not say.",
        tone: "Dramatic",
        premiseBeat:
          "AoT fan ending: a letter never sent, then almost sent. Intimate panels. Classic designs.",
      }
    ),
  },
  {
    id: "spy-x-family",
    title: "Spy x Family",
    subtitle: "スパイファミリー",
    tag: "Comedy",
    synopsis:
      "The mission succeeded. The fake family somehow became real. Nobody wants to be the first to admit it.",
    cliffhanger: "Covers are optional now. Do they keep the house?",
    genre: "Comedy slice of life",
    setting: "Forger apartment kitchen at evening",
    language: "English",
    styleKey: "chibi",
    accent: "#e07a5c",
    cast: [
      { name: "Loid", look: "Loid Forger — blond spy dad in sweater, soft smile, Spy x Family style" },
      { name: "Yor", look: "Yor Forger — black hair, elegant, awkward kindness, Spy x Family style" },
      { name: "Anya", look: "Anya Forger — pink hair, big eyes, chaotic cute, Spy x Family style" },
      { name: "Bond", look: "Bond — large white fluffy dog, Spy x Family style" },
    ],
    endings: paths(
      {
        id: "lease",
        title: "We keep the lie",
        blurb: "They renew the lease. On purpose.",
        tone: "Wholesome",
        premiseBeat:
          "Spy x Family fan ending: family admits they want to stay. Soft comedy, big feelings. Exact character designs.",
      },
      {
        id: "festival",
        title: "School festival",
        blurb: "Anya's play. Parents panic-support.",
        tone: "Comedic",
        premiseBeat:
          "Spy x Family fan ending: school festival chaos. Spy/assassin skills for crafts. Classic looks.",
      },
      {
        id: "truth",
        title: "Truth night",
        blurb: "One secret each. No missions.",
        tone: "Heartfelt",
        premiseBeat:
          "Spy x Family fan ending: gentle truth-telling night. Trust + humor. Classic designs.",
      }
    ),
  },
  {
    id: "frieren",
    title: "Frieren",
    subtitle: "葬送のフリーレン",
    tag: "Fantasy",
    synopsis:
      "Another journey ends. An elf measures time in centuries; her companions measure it in seasons.",
    cliffhanger: "The next map is blank. Who walks with her?",
    genre: "Fantasy slice of life",
    setting: "A misty road at golden hour",
    language: "English",
    styleKey: "spirit",
    accent: "#7a9e8e",
    cast: [
      { name: "Frieren", look: "Frieren — elf mage, long white hair, calm distant eyes, staff, Frieren anime style" },
      { name: "Fern", look: "Fern — purple hair, polite firm apprentice, Frieren style" },
      { name: "Stark", look: "Stark — red hair, earnest awkward warrior, Frieren style" },
    ],
    endings: paths(
      {
        id: "decade",
        title: "One more decade",
        blurb: "She stays in a village longer than planned.",
        tone: "Heartfelt",
        premiseBeat:
          "Frieren fan ending: staying put, learning human pace. Classic character designs.",
      },
      {
        id: "graves",
        title: "Grave visit",
        blurb: "Flowers for an old party.",
        tone: "Bittersweet",
        premiseBeat:
          "Frieren fan ending: visiting graves of old companions. Soft grief. Classic looks.",
      },
      {
        id: "cake",
        title: "Magic exam epilogue",
        blurb: "Fern passes. Cake happens.",
        tone: "Wholesome",
        premiseBeat:
          "Frieren fan ending: celebration after an exam. Small talk that means everything.",
      }
    ),
  },
  {
    id: "chainsaw-man",
    title: "Chainsaw Man",
    subtitle: "チェンソーマン",
    tag: "Seinen",
    synopsis:
      "The devil deals go quiet for a night. Someone wants toast. Someone else wants a dream that is embarrassingly small.",
    cliffhanger: "Power is gone or changed. What is left to want?",
    genre: "Dark comedy",
    setting: "Cheap apartment kitchen at night",
    language: "English",
    styleKey: "neon",
    accent: "#d94f4f",
    cast: [
      { name: "Denji", look: "Denji — spiky blond, sharp teeth vibe, simple clothes, Chainsaw Man style" },
      { name: "Aki", look: "Aki Hayakawa — dark hair, serious tired kindness, CSM style" },
      { name: "Power", look: "Power — horns, pale hair, chaotic smug fiend, CSM style" },
    ],
    endings: paths(
      {
        id: "toast",
        title: "Simple dream",
        blurb: "Toast. Touch. A morning without blood.",
        tone: "Heartfelt",
        premiseBeat:
          "Chainsaw Man fan ending: quiet morning of small human wants. Tender. Exact character vibes.",
      },
      {
        id: "deal",
        title: "New contract",
        blurb: "A ridiculous devil offers a silly deal.",
        tone: "Comedic",
        premiseBeat:
          "CSM fan ending: absurd devil bargain for something tiny. Dark comedy. Classic designs.",
      },
      {
        id: "remember",
        title: "Remember them",
        blurb: "He talks to an empty room.",
        tone: "Dramatic",
        premiseBeat:
          "CSM fan ending: grief monologue that turns into choosing to live. Classic looks.",
      }
    ),
  },
  {
    id: "death-note",
    title: "Death Note",
    subtitle: "デスノート",
    tag: "Thriller",
    synopsis:
      "The notebook is gone. Rain hits a rooftop. Two minds that tried to play god have to live as people again.",
    cliffhanger: "No more pages. Who wins the silence?",
    genre: "Psychological thriller",
    setting: "Tokyo rooftop in rain",
    language: "English",
    styleKey: "shadow",
    accent: "#5c6b7a",
    cast: [
      { name: "Light", look: "Light Yagami — neat brown hair, sharp eyes, school uniform, Death Note style" },
      { name: "L", look: "L — messy black hair, crouched posture, tired eyes, Death Note style" },
    ],
    endings: paths(
      {
        id: "rain",
        title: "Rain truce",
        blurb: "They share a silence. No notebook.",
        tone: "Mysterious",
        premiseBeat:
          "Death Note fan ending: rain rooftop without the notebook. Tension + humanity. Exact designs.",
      },
      {
        id: "jobs",
        title: "Ordinary jobs",
        blurb: "Detective work. Student life. Boredom as mercy.",
        tone: "Bittersweet",
        premiseBeat:
          "Death Note fan ending: parallel ordinary days. Irony and quiet. Classic looks.",
      },
      {
        id: "cake",
        title: "One last cake",
        blurb: "L buys sweets. Light almost laughs.",
        tone: "Heartfelt",
        premiseBeat:
          "Death Note fan ending: soft almost-friendship. Unexpected warmth. Classic designs.",
      }
    ),
  },
  {
    id: "haikyuu",
    title: "Haikyuu!!",
    subtitle: "ハイキュー!!",
    tag: "Sports",
    synopsis:
      "The final whistle already sounded. The gym lights click off. Someone still hears the ball bounce in their chest.",
    cliffhanger: "Nationals end. What is the next serve?",
    genre: "Sports",
    setting: "Empty high school gym at night",
    language: "English",
    styleKey: "slayer",
    accent: "#e0a020",
    cast: [
      { name: "Hinata", look: "Shoyo Hinata — short orange hair, bright eyes, Haikyuu style" },
      { name: "Kageyama", look: "Tobio Kageyama — tall dark hair, intense setter focus, Haikyuu style" },
      { name: "Tsukishima", look: "Kei Tsukishima — blond tall blocker, glasses, dry wit, Haikyuu style" },
      { name: "Yamaguchi", look: "Tadashi Yamaguchi — freckles, kind smile, Haikyuu style" },
    ],
    endings: paths(
      {
        id: "rally",
        title: "One more rally",
        blurb: "Just them. No crowd.",
        tone: "Heartfelt",
        premiseBeat:
          "Haikyuu fan ending: late-night practice between rivals-friends. Joy of the sport. Exact designs.",
      },
      {
        id: "pro",
        title: "Pro road",
        blurb: "Train tickets. Different cities. Same dream.",
        tone: "Hopeful",
        premiseBeat:
          "Haikyuu fan ending: parting for pro paths. Classic looks.",
      },
      {
        id: "alumni",
        title: "Coach visit",
        blurb: "They return as alumni and lose to kids.",
        tone: "Comedic",
        premiseBeat:
          "Haikyuu fan ending: alumni scrimmage, funny losses, full hearts.",
      }
    ),
  },
  {
    id: "horimiya",
    title: "Horimiya",
    subtitle: "ホリミヤ",
    tag: "Romance",
    synopsis:
      "School ends. The softest romance still has a next page — apartments, part-time jobs, texting at 1am.",
    cliffhanger: "Graduation is done. Who says the scary sentence first?",
    genre: "Romance slice of life",
    setting: "Small apartment balcony in spring",
    language: "English",
    styleKey: "chibi",
    accent: "#d9899b",
    cast: [
      { name: "Hori", look: "Kyoko Hori — brown hair, soft domestic side, warm smile, Horimiya style" },
      { name: "Miyamura", look: "Izumi Miyamura — black hair, piercings, gentle shy energy, Horimiya style" },
    ],
    endings: paths(
      {
        id: "move",
        title: "Moving day",
        blurb: "Boxes, noodles, a shared key.",
        tone: "Wholesome",
        premiseBeat:
          "Horimiya fan ending: moving in together. Soft comedy. Exact character designs.",
      },
      {
        id: "parents",
        title: "Meet the parents",
        blurb: "Dinner. Panic. Love wins.",
        tone: "Comedic",
        premiseBeat:
          "Horimiya fan ending: awkward family dinner. Heart under humor.",
      },
      {
        id: "ten",
        title: "Ten years later",
        blurb: "Same balcony. Quieter joy.",
        tone: "Heartfelt",
        premiseBeat:
          "Horimiya fan ending: time-skip evening. Grown love, small rituals.",
      }
    ),
  },
  {
    id: "spirited-away",
    title: "Spirited Away",
    subtitle: "千と千尋の神隠し",
    tag: "Ghibli",
    synopsis:
      "The train ride home already happened. A girl remembers a name. The tunnel is still there if you look.",
    cliffhanger: "She is back. Does she ever return — and why?",
    genre: "Fantasy",
    setting: "Tunnel entrance in late summer grass",
    language: "English",
    styleKey: "spirit",
    accent: "#6a9aaa",
    cast: [
      { name: "Chihiro", look: "Chihiro Ogino — brave young girl, simple clothes, Spirited Away / Ghibli style" },
      { name: "Haku", look: "Haku — kind boy with dragon-spirit aura, Ghibli style" },
      { name: "Lin", look: "Lin — sharp working spirit woman, tough care, Ghibli style" },
    ],
    endings: paths(
      {
        id: "dream",
        title: "Visit in dreams",
        blurb: "She finds the tunnel again — briefly.",
        tone: "Mysterious",
        premiseBeat:
          "Spirited Away fan ending / fan art: dream return to the spirit world. Soft wonder. Ghibli-like designs.",
      },
      {
        id: "school",
        title: "Ordinary courage",
        blurb: "First day at a new school. She is not afraid.",
        tone: "Hopeful",
        premiseBeat:
          "Spirited Away fan ending: real-world courage after the journey. Classic looks.",
      },
      {
        id: "letter",
        title: "Letter to Haku",
        blurb: "She writes a name so she will not forget.",
        tone: "Heartfelt",
        premiseBeat:
          "Spirited Away fan ending: writing a letter she cannot send. Memory and gratitude.",
      }
    ),
  },
  {
    id: "your-name",
    title: "Your Name",
    subtitle: "君の名は。",
    tag: "Film",
    synopsis:
      "They remembered. Then life got busy. A train platform still exists where two people almost miss each other forever.",
    cliffhanger: "Memory held. What is the first date after fate?",
    genre: "Romance fantasy",
    setting: "Tokyo train stairs at sunset",
    language: "English",
    styleKey: "neon",
    accent: "#7b9fd4",
    cast: [
      { name: "Taki", look: "Taki Tachibana — Tokyo teen, earnest, school bag, Your Name / Shinkai style" },
      { name: "Mitsuha", look: "Mitsuha Miyamizu — tied hair, bright determined eyes, Your Name style" },
    ],
    endings: paths(
      {
        id: "hello",
        title: "First real hello",
        blurb: "They finally introduce themselves — properly.",
        tone: "Heartfelt",
        premiseBeat:
          "Your Name fan ending: staircase meeting continues into a first walk. Cinematic. Exact character vibes.",
      },
      {
        id: "ld",
        title: "Twin timelines",
        blurb: "A day in each city, texting across.",
        tone: "Wholesome",
        premiseBeat:
          "Your Name fan ending: long-distance early relationship. Parallel panels.",
      },
      {
        id: "comet",
        title: "Comet anniversary",
        blurb: "They watch the sky together, awake.",
        tone: "Dramatic",
        premiseBeat:
          "Your Name fan ending: comet anniversary night. Quiet awe, held hands.",
      }
    ),
  },
  {
    id: "mob-psycho",
    title: "Mob Psycho 100",
    subtitle: "モブサイコ100",
    tag: "Shonen",
    synopsis:
      "The psychic storms settle. A middle schooler wants to be ordinary so badly it becomes extraordinary.",
    cliffhanger: "Power stays. Ego softens. What is growth now?",
    genre: "Supernatural comedy",
    setting: "City park after club practice",
    language: "English",
    styleKey: "neon",
    accent: "#5a8f6a",
    cast: [
      { name: "Mob", look: "Shigeo Kageyama (Mob) — bowl cut, plain clothes, quiet kindness, Mob Psycho style" },
      { name: "Reigen", look: "Arataka Reigen — blond suit mentor, wise grin, Mob Psycho style" },
      { name: "Dimple", look: "Dimple — green spirit face, sarcastic, Mob Psycho style" },
    ],
    endings: paths(
      {
        id: "100",
        title: "100%",
        blurb: "Feelings without destruction.",
        tone: "Heartfelt",
        premiseBeat:
          "Mob Psycho fan ending: emotional climax that stays gentle. Exact designs.",
      },
      {
        id: "office",
        title: "Office day",
        blurb: "Exorcism consults and bad coffee.",
        tone: "Comedic",
        premiseBeat:
          "Mob Psycho fan ending: funny consultation office day. Classic looks.",
      },
      {
        id: "run",
        title: "Body improvement",
        blurb: "They run. They improve. They laugh.",
        tone: "Wholesome",
        premiseBeat:
          "Mob Psycho fan ending: club run epilogue. Simple joy.",
      }
    ),
  },
  {
    id: "bleach",
    title: "Bleach",
    subtitle: "ブリーチ",
    tag: "Shonen",
    synopsis:
      "Soul Society is quiet. A substitute shinigami hangs up the badge for a night and still hears the rain on Karakura roofs.",
    cliffhanger: "Peace holds. Who visits from the other side?",
    genre: "Supernatural action",
    setting: "Karakura town rooftop in rain",
    language: "English",
    styleKey: "slayer",
    accent: "#4a6fa5",
    cast: [
      { name: "Ichigo", look: "Ichigo Kurosaki — orange spiky hair, black shihakusho, Bleach style" },
      { name: "Rukia", look: "Rukia Kuchiki — short black hair, shinigami robes, Bleach style" },
      { name: "Orihime", look: "Orihime Inoue — long orange hair, kind, Bleach style" },
      { name: "Chad", look: "Yasutora Sado — tall quiet strength, Bleach style" },
    ],
    endings: paths(
      {
        id: "rain",
        title: "Rain talk",
        blurb: "Ichigo and Rukia on a roof. No hollows.",
        tone: "Heartfelt",
        premiseBeat:
          "Bleach fan ending: quiet rain conversation. Classic character designs.",
      },
      {
        id: "school",
        title: "Back to school",
        blurb: "Ordinary classes. Extraordinary friends.",
        tone: "Wholesome",
        premiseBeat:
          "Bleach fan ending: school day slice-of-life after war. Classic looks.",
      },
      {
        id: "visit",
        title: "Soul Society visit",
        blurb: "A friendly trip — not a battle.",
        tone: "Hopeful",
        premiseBeat:
          "Bleach fan ending: peaceful visit to Soul Society. Warm reunion energy.",
      }
    ),
  },
  {
    id: "fruits-basket",
    title: "Fruits Basket",
    subtitle: "フルーツバスケット",
    tag: "Drama",
    synopsis:
      "The curse is broken. Zodiac animals are only memories. Someone still sets an extra bowl out of habit.",
    cliffhanger: "Freedom is new. What does a chosen family look like now?",
    genre: "Drama romance",
    setting: "Sohma household garden in spring",
    language: "English",
    styleKey: "chibi",
    accent: "#c97b84",
    cast: [
      { name: "Tohru", look: "Tohru Honda — brown hair, kind smile, Fruits Basket style" },
      { name: "Kyo", look: "Kyo Sohma — orange hair, soft after the curse, Fruits Basket style" },
      { name: "Yuki", look: "Yuki Sohma — silver hair, gentle prince energy, Fruits Basket style" },
    ],
    endings: paths(
      {
        id: "garden",
        title: "Spring garden",
        blurb: "No transformations. Just tea.",
        tone: "Wholesome",
        premiseBeat:
          "Fruits Basket fan ending: spring garden tea. Soft healing. Exact designs.",
      },
      {
        id: "wedding",
        title: "Small wedding",
        blurb: "Found family in the front row.",
        tone: "Heartfelt",
        premiseBeat:
          "Fruits Basket fan ending: intimate wedding. Tears and laughter. Classic looks.",
      },
      {
        id: "letter",
        title: "Letter to Mom",
        blurb: "Tohru writes what she finally understands.",
        tone: "Dramatic",
        premiseBeat:
          "Fruits Basket fan ending: letter to her mother. Gentle closure.",
      }
    ),
  },
];

export const FEATURED_ENDING = ENDING_CATALOG[0];

export function listEndingCatalog(): FeaturedEndingManga[] {
  return ENDING_CATALOG;
}

export function getFeaturedEnding(id: string): FeaturedEndingManga | null {
  return ENDING_CATALOG.find((m) => m.id === id) ?? null;
}

export function getEndingChoice(
  manga: FeaturedEndingManga,
  choiceId: string
): EndingChoice | null {
  return manga.endings.find((e) => e.id === choiceId) ?? null;
}

export function buildEndingPremise(
  manga: FeaturedEndingManga,
  choice: EndingChoice,
  customNote?: string
): string {
  const note = customNote?.trim()
    ? `\n\nCreator's extra direction (honor this): ${customNote.trim().slice(0, 280)}`
    : "";
  return (
    `Create a FAN ART / FAN ENDING manga epilogue for "${manga.title}" (${manga.subtitle}). ` +
    `This is unofficial fandom creative work — fan fiction + fan art style. ` +
    `Match the official character designs and series art vibe as closely as possible. ` +
    `Context: ${manga.synopsis} ` +
    `${choice.premiseBeat}` +
    note +
    ` Keep cast consistent. Dialogue in ${manga.language}. 4–6 panels. ` +
    `Title it like a real epilogue. Label energy: fan ending, not official chapter.`
  );
}

/** Agentic: user types any manga title. */
export interface CustomEndingRequest {
  title: string;
  synopsis: string;
  endingTitle: string;
  endingBlurb: string;
  tone: string;
  premiseBeat: string;
  customNote?: string;
  language?: string;
  styleKey?: StyleKey;
}

export function buildCustomEndingPremise(req: CustomEndingRequest): string {
  const note = req.customNote?.trim()
    ? `\n\nCreator's extra direction: ${req.customNote.trim().slice(0, 280)}`
    : "";
  return (
    `Create a FAN ART / FAN ENDING manga epilogue for "${req.title}". ` +
    `Unofficial fandom work — match well-known character designs and series style as closely as possible. ` +
    `Context: ${req.synopsis.slice(0, 600)} ` +
    `Ending "${req.endingTitle}" (${req.tone}): ${req.premiseBeat}. ${req.endingBlurb}` +
    note +
    ` Invent cast with accurate iconic looks if the series is famous. Dialogue in ${req.language || "English"}. 4–6 panels.`
  );
}
