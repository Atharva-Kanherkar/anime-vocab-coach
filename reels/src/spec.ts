// A reel is described by one JSON spec (see specs/demo.json). The renderer
// never hardcodes content — pass a spec with --props to render any reel.

export type Zoom = "in" | "out";
export type Focus = "center" | "top" | "bottom";

export interface Scene {
  /** Path under public/ (staticFile). Studio panel, manga page, card art… */
  image: string;
  /** Narration caption shown at the bottom. */
  text: string;
  /** Optional narration audio under public/ — scene lasts as long as it. */
  audio?: string;
  /** Ken Burns direction; defaults alternate in/out by index. */
  zoom?: Zoom;
  /** Which part of a tall page to favor when cropping. */
  focus?: Focus;
  /** Seconds override when there is no audio (default: reading speed). */
  seconds?: number;
}

export interface ReelSpec {
  /** Big hook line on the opening card, e.g. "Nezuko was never the demon". */
  title: string;
  /** Small chip above the title, e.g. "DEMON SLAYER THEORY". */
  series: string;
  /** Credit line for the panels, shown small on the end card and first scene. */
  credit?: string;
  /** CTA on the end card. */
  handle: string;
  /** Optional looping ambient track under public/. */
  music?: string;
  /** Accent color (progress bar, chip). */
  accent?: string;
  scenes: Scene[];
}

export const FPS = 30;
export const TITLE_SECONDS = 2.2;
export const END_SECONDS = 2.6;
/** Caption reading speed used when a scene has no narration audio. */
export const WORDS_PER_SECOND = 2.6;
export const MIN_SCENE_SECONDS = 2.4;
export const MAX_SCENE_SECONDS = 9;

export function sceneSecondsFallback(scene: Scene): number {
  if (scene.seconds) return scene.seconds;
  const words = scene.text.trim().split(/\s+/).length;
  return Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, words / WORDS_PER_SECOND + 0.9));
}

export const demoSpec: ReelSpec = {
  title: "She reads manga she can't read yet",
  series: "MANGA STORYTIME",
  credit: "panels: AnimeVocab Manga Studio",
  handle: "animevocab.com/studio",
  accent: "#e4572e",
  scenes: [
    { image: "demo/p1.webp", text: "This whole chapter was drawn by someone who can't draw.", zoom: "in", focus: "top" },
    { image: "demo/p2.webp", text: "They typed one premise. The AI storyboarded every panel.", zoom: "out" },
    { image: "demo/p3.webp", text: "Then they redrew the hero's face until it felt like theirs.", zoom: "in", focus: "center" },
    { image: "demo/p4.webp", text: "Every line of dialogue is editable. Speech, thought, even the SFX.", zoom: "out", focus: "bottom" },
    { image: "demo/p5.webp", text: "It's free to try. No account. Your first chapter takes ten minutes.", zoom: "in" },
  ],
};
