// Featured "ended manga" hooks for Instagram / paid social.
// v1: one curated finale (Lantern of Words) with three creative endings.
// Visitors pick an ending → Studio drafts their personal epilogue chapter.

import type { StyleKey } from "@/lib/cards";
import type { StudioCastMember } from "@/lib/studio";

export type EndingChoiceId = "reunion" | "comedy" | "quiet";

export interface EndingChoice {
  id: EndingChoiceId;
  title: string;
  blurb: string;
  /** Injected into the Studio premise so the model writes THIS finale. */
  premiseBeat: string;
  tone: string;
}

export interface FeaturedEndingManga {
  id: string;
  title: string;
  subtitle: string;
  synopsis: string;
  /** Short teaser shown on /from-reel and /end/[id]. */
  cliffhanger: string;
  genre: string;
  setting: string;
  language: string;
  styleKey: StyleKey;
  cast: StudioCastMember[];
  endings: EndingChoice[];
}

/** Canonical featured hook — Lantern of Words after the official epilogue. */
export const FEATURED_ENDING: FeaturedEndingManga = {
  id: "lantern-of-words",
  title: "The Lantern of Words",
  subtitle: "言葉の灯 — after the finale",
  synopsis:
    "Sixty keepers restored the silence between words. Mu has a name again. The campfire at Bhimbetka burns ordinary orange — but one distant thread still hums in a tongue no one knows.",
  cliffhanger:
    "The war is over. One strand past the comet still hums. How does YOUR story end?",
  genre: "Fantasy adventure",
  setting: "Bhimbetka rock shelters at dusk, after the Unwritten Sea",
  language: "English",
  styleKey: "spirit",
  cast: [
    {
      name: "Sen",
      look: "slight teen in a dark windbreaker, face never fully shown, quiet resolve, calligraphy brush nearby",
    },
    {
      name: "Mu",
      look: "small quiet person-shaped figure now drawn in soft complete ink, keeper of the pause between words, curious and gentle",
    },
    {
      name: "Pip",
      look: "tiny German girl in an oversized coat, empathetic, tear-bright eyes, hears what others miss",
    },
    {
      name: "Rafa",
      look: "small cheerful Oaxacan boy, always waving, fearless friendliness",
    },
  ],
  endings: [
    {
      id: "reunion",
      title: "Bittersweet reunion",
      blurb: "The humming strand is a lost word coming home — someone you love is on the other end.",
      tone: "Heartfelt",
      premiseBeat:
        "Write a 4–6 panel EPILOGUE ending: the distant humming strand is a lost word returning. Sen, Mu, Pip, and Rafa follow it to a quiet reunion with someone thought erased. Emotional, bittersweet, hopeful. End on a named word being spoken aloud with meaning.",
    },
    {
      id: "comedy",
      title: "Chaotic comedy twist",
      blurb: "Mochi eats the humming strand. Reality gets weird. The keepers have to improvise.",
      tone: "Comedic",
      premiseBeat:
        "Write a 4–6 panel EPILOGUE ending: a round snack gremlin named Mochi chomps the humming cosmic strand and briefly becomes the most dangerous (and ridiculous) being alive. Sen, Mu, Pip, and Rafa scramble to fix it with slapstick and heart. Funny first, warm finish.",
    },
    {
      id: "quiet",
      title: "Quiet slice-of-life",
      blurb: "No more battles. Soup, notebooks, and the first ordinary morning after saving the world.",
      tone: "Wholesome",
      premiseBeat:
        "Write a 4–6 panel EPILOGUE ending: pure slice-of-life after the war. Campfire soup, Mu practicing saying their name, Pip teaching Rafa a new word, Sen sketching in a notebook. No villains. Soft, cozy, earned peace. End on a small shared laugh.",
    },
  ],
};

export function getFeaturedEnding(id: string): FeaturedEndingManga | null {
  if (id === FEATURED_ENDING.id) return FEATURED_ENDING;
  return null;
}

export function getEndingChoice(
  manga: FeaturedEndingManga,
  choiceId: string
): EndingChoice | null {
  return manga.endings.find((e) => e.id === choiceId) ?? null;
}

/** Build the Studio draft premise from a featured manga + ending pick. */
export function buildEndingPremise(
  manga: FeaturedEndingManga,
  choice: EndingChoice,
  customNote?: string
): string {
  const note = customNote?.trim()
    ? `\n\nCreator's extra direction (honor this): ${customNote.trim().slice(0, 280)}`
    : "";
  return (
    `This is a fan EPILOGUE chapter for the finished manga "${manga.title}". ` +
    `Canon context: ${manga.synopsis} ` +
    `${choice.premiseBeat}` +
    note +
    ` Keep the cast consistent. Dialogue in ${manga.language}. Title the chapter like a real manga epilogue.`
  );
}
