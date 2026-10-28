import type { N5Text } from "../../../shared/n5/contracts";

export const COURSE_ID = "n5-foundations";
export const CONTENT_VERSION = "preview-1";
export const LESSON_ID = "your-lie-in-april-s1-e1";
export const TRACK_ID = "your-lie-in-april-2014";
export const EPISODE_ID = "your-lie-in-april-2014-s1-e1";
export const TRACKS = [
  { id: TRACK_ID, title: "Your Lie in April", adaptation: "2014 TV", season: "1", status: "unreviewed_preview" },
  { id: "spy-x-family-2022", title: "SPY x FAMILY", adaptation: "2022 TV", season: "1", status: "planned" },
  { id: "bocchi-the-rock-2022", title: "BOCCHI THE ROCK!", adaptation: "2022 TV", season: "1", status: "planned" },
  { id: "laid-back-camp-2018", title: "Laid-Back Camp", adaptation: "2018 TV", season: "1", status: "planned" },
  { id: "haikyu-2014", title: "Haikyu!!", adaptation: "2014 TV", season: "1", status: "planned" },
  { id: "fruits-basket-2019", title: "Fruits Basket", adaptation: "2019 TV", season: "1", status: "planned" },
] as const;
export const UNITS = [
  "Greet and introduce yourself", "Ask who someone is", "Family and belongings", "Everyday objects",
  "Where things are", "Time and dates", "Daily routines", "Yesterday", "Destinations and transport",
  "Shopping and quantities", "Descriptions", "Likes and hobbies", "Invitations and plans", "Polite requests",
  "Ongoing actions", "Permission and rules", "Wants and purpose", "Abilities and activities",
  "Common casual forms", "Comparisons", "Simple reasons", "Everyday messages", "Unfamiliar situations",
  "Cumulative and delayed assessment",
].map((title, index) => ({ id: `unit-${index + 1}`, title, status: index === 0 ? "unreviewed_preview" : "planned" }));

interface PrivateQuestion {
  id: string;
  kind: "choice" | "production";
  objectiveId: string;
  prompt: string;
  choices?: { id: string; text: N5Text }[];
  correctOption?: string;
}
const t = (romaji: string, kana: string): N5Text => ({ romaji, kana });
// Original pedagogical examples, not quoted episode dialogue. No educator review claimed.
export const QUESTIONS: readonly PrivateQuestion[] = [
  { id: "greeting", kind: "choice", objectiveId: "greet", prompt: "Choose a polite greeting for a first meeting.", correctOption: "b", choices: [
    { id: "a", text: t("oyasuminasai", "おやすみなさい") }, { id: "b", text: t("hajimemashite", "はじめまして") }, { id: "c", text: t("itadakimasu", "いただきます") }] },
  { id: "name", kind: "choice", objectiveId: "introduce", prompt: "Choose: I am Haru.", correctOption: "a", choices: [
    { id: "a", text: t("watashi wa Haru desu", "わたしはハルです") }, { id: "b", text: t("Haru wa doko desu ka", "ハルはどこですか") }, { id: "c", text: t("Haru deshita ka", "ハルでしたか") }] },
  { id: "question", kind: "choice", objectiveId: "introduce", prompt: "Choose the polite question ending.", correctOption: "c", choices: [
    { id: "a", text: t("desu", "です") }, { id: "b", text: t("deshita", "でした") }, { id: "c", text: t("desu ka", "ですか") }] },
  { id: "friend", kind: "choice", objectiveId: "people", prompt: "Which word means friend?", correctOption: "b", choices: [
    { id: "a", text: t("sensei", "せんせい") }, { id: "b", text: t("tomodachi", "ともだち") }, { id: "c", text: t("gakusei", "がくせい") }] },
  { id: "student", kind: "choice", objectiveId: "people", prompt: "Which word means student?", correctOption: "c", choices: [
    { id: "a", text: t("tomodachi", "ともだち") }, { id: "b", text: t("sensei", "せんせい") }, { id: "c", text: t("gakusei", "がくせい") }] },
  { id: "thanks", kind: "choice", objectiveId: "greet", prompt: "Choose a polite thank you.", correctOption: "a", choices: [
    { id: "a", text: t("arigatou gozaimasu", "ありがとうございます") }, { id: "b", text: t("ohayou gozaimasu", "おはようございます") }, { id: "c", text: t("hajimemashite", "はじめまして") }] },
  { id: "morning", kind: "choice", objectiveId: "greet", prompt: "Choose a polite good morning.", correctOption: "b", choices: [
    { id: "a", text: t("konbanwa", "こんばんは") }, { id: "b", text: t("ohayou gozaimasu", "おはようございます") }, { id: "c", text: t("oyasuminasai", "おやすみなさい") }] },
  { id: "read", kind: "choice", objectiveId: "introduce", prompt: "Choose: I am a student.", correctOption: "c", choices: [
    { id: "a", text: t("watashi wa sensei desu", "わたしはせんせいです") }, { id: "b", text: t("watashi wa tomodachi desu", "わたしはともだちです") }, { id: "c", text: t("watashi wa gakusei desu", "わたしはがくせいです") }] },
  { id: "write-name", kind: "production", objectiveId: "introduce", prompt: "Introduce yourself as Haru in one polite sentence." },
  { id: "write-greeting", kind: "production", objectiveId: "greet", prompt: "Write a polite greeting for meeting a new classmate." },
];
