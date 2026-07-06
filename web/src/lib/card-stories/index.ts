import { CARDS, getCardById, type CardDef } from "@/lib/cards";
import { CARD_STORIES, KOTODAMA_INTRO, type CardStory, type StoryLang } from "./data";

export type { CardStory, StoryLang };
export { KOTODAMA_INTRO, CARD_STORIES, getCardById };

export function getCardStory(id: string): CardStory | undefined {
  return CARD_STORIES[id];
}

export function mentionedCards(story: CardStory): CardDef[] {
  return story.mentions
    .map((id) => getCardById(id))
    .filter((c): c is CardDef => !!c);
}

export const STORY_LANGS: { id: StoryLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ja", label: "日本語" },
  { id: "romaji", label: "Romaji" },
];
