// Ending Funnel — the Instagram-ad "Choose Your Ending" experience.
//
// This is a MARKETING FUNNEL, deliberately separate from Manga Studio:
//   - Studio = a creative tool for people who want to author manga (accounts,
//     editors, galleries, monthly budgets).
//   - Funnel = a visitor from a reel taps one ending and watches a finished
//     5-panel fan-art manga draw itself. Zero editing, zero learning curve.
//
// Its own backend (/api/ending/*), its own gate (one free 5-panel manga per
// IP, then the paywall), and its own image prompt: unlike Studio (which bans
// text in art and renders HTML bubbles), the funnel bakes the dialogue INTO
// the artwork as hand-lettered speech bubbles, so every panel is a complete,
// screenshot-shareable manga page.

import { STYLE_FAMILIES, type StyleKey } from "@/lib/cards";
import type { MangaLine, StudioCastMember, StudioPanelScript } from "@/lib/studio";

// ── Constants ──────────────────────────────────────────────────────────────

/** Frames per ending. The free taste = exactly one of these. */
export const ENDING_PANEL_COUNT = 5;

/** Free endings per IP (not per day — per IP, until the key ages out). */
export const DEFAULT_ENDING_FREE_PER_IP = 1;
/** Signed-in (free account) endings per month — the sign-up carrot. */
export const DEFAULT_ENDING_SIGNED_PER_MONTH = 3;
/** Global creations/day safety valve for ad-traffic spikes / IP rotation. */
export const DEFAULT_ENDING_GLOBAL_PER_DAY = 400;

export const ENDING_IMAGE_SIZE = "1024x1024";

export const MAX_ENDING_LINES_PER_PANEL = 2;
export const MAX_ENDING_LINE_LEN = 90;

// ── Types ──────────────────────────────────────────────────────────────────

export interface EndingScript {
  title: { en: string; sub: string };
  logline: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
}

/** The KV record for one generated ending (see ending-store.ts). */
export interface EndingCreation extends EndingScript {
  id: string;
  createdAt: string;
  source: "catalog" | "custom";
  seriesTitle: string;
  seriesSub: string;
  endingTitle: string;
  tone: string;
  styleKey: StyleKey;
  accent: string;
  language: string;
  /** Panels whose art has been generated and stored (0..ENDING_PANEL_COUNT). */
  done: number;
}

// ── Funnel analytics events ────────────────────────────────────────────────
// Server-side counters (KV, per-day + total) so ad performance is measurable
// without trusting the pixel. Keep the list tight and additive.

export const ENDING_EVENTS = [
  "land_reel", // /from-reel viewed
  "land_end", // /end catalog viewed
  "land_series", // /end/[id] viewed
  "land_custom", // /end/custom viewed
  "options_invented", // custom title → 3 endings invented
  "ending_pick", // an ending card selected
  "generate_start", // generate requested
  "script_ok", // script written, manga started
  "panel_done", // one panel image finished
  "ending_complete", // all 5 panels finished
  "share_view", // /e/[id] viewed by anyone
  "share_click", // share button used
  "paywall_shown", // free limit hit
  "paywall_signup", // paywall → sign-up click
  "paywall_checkout", // paywall → Pro checkout click
] as const;

export type EndingEvent = (typeof ENDING_EVENTS)[number];

export function isEndingEvent(v: unknown): v is EndingEvent {
  return typeof v === "string" && (ENDING_EVENTS as readonly string[]).includes(v);
}

// ── Script prompt ──────────────────────────────────────────────────────────
// One chat call writes the whole 5-panel epilogue. Dialogue is written to be
// HAND-LETTERED INTO THE ART, so lines must be short and punchy.

export interface EndingScriptRequest {
  seriesTitle: string;
  seriesSub?: string;
  synopsis: string;
  endingTitle: string;
  tone: string;
  premiseBeat: string;
  customNote?: string;
  language: string;
  cast: StudioCastMember[];
}

export function buildEndingScriptPrompt(req: EndingScriptRequest): {
  system: string;
  user: string;
} {
  const system =
    "You are a professional mangaka writing a FAN-MADE ending chapter (doujinshi-style fan art) " +
    "for a famous manga/anime. This is unofficial fandom creative play — like fan art and fan " +
    "fiction that devoted fans make as tribute. Write the beloved canon characters accurately: " +
    "their real names, personalities, relationships, and speech patterns, so fans instantly feel " +
    "'that is SO them'.\n\n" +
    `Write EXACTLY ${ENDING_PANEL_COUNT} panels forming a complete mini-chapter with a cinematic arc:\n` +
    "1. Re-establish the world right after the finale (a held breath).\n" +
    "2. Build — the chosen ending premise starts moving.\n" +
    "3. The emotional turn.\n" +
    "4. The payoff beat fans came for.\n" +
    "5. The final shot — quiet, iconic, quotable. It should land like the last page of a series.\n\n" +
    "Rules:\n" +
    "- Each panel has `scene`: a purely VISUAL description for the artist — which characters, " +
    "action, setting, camera framing, lighting, emotion. Never mention text or bubbles in `scene`.\n" +
    `- Each panel has 0-${MAX_ENDING_LINES_PER_PANEL} \`lines\`. The dialogue gets hand-lettered ` +
    "INTO speech bubbles in the artwork, so every line must be SHORT — 8 words or fewer, punchy, " +
    "like real manga lettering. No line breaks inside a line.\n" +
    '- Line `kind` is "speech" (spoken), "thought" (internal), "narration" (caption box), or ' +
    '"sfx" (one onomatopoeia like BOOM or ドン). `speaker` is the character name for ' +
    "speech/thought, empty otherwise.\n" +
    "- Panel 5's last line should hit like a series finale.\n" +
    "- Define the CAST (2-4 characters) with `look`: a detailed description of each character's " +
    "iconic OFFICIAL appearance (hair, outfit, defining features) so the artist draws them " +
    "instantly recognizable.\n" +
    "- Give the chapter a TITLE (main + short stylized subtitle) and a one-line LOGLINE.\n" +
    "- Write all dialogue in the requested LANGUAGE.\n" +
    '- Respond ONLY as strict JSON: {"title":{"en":string,"sub":string},"logline":string,' +
    '"cast":[{"name":string,"look":string}],"panels":[{"scene":string,' +
    '"lines":[{"kind":string,"speaker":string,"text":string}]}]}';

  const parts: string[] = [
    `SERIES: ${req.seriesTitle}${req.seriesSub ? ` (${req.seriesSub})` : ""}`,
    `WHERE THE STORY LEFT OFF: ${req.synopsis}`,
    `THE FAN ENDING TO WRITE — "${req.endingTitle}" (${req.tone}): ${req.premiseBeat}`,
  ];
  if (req.customNote?.trim()) {
    parts.push(`THE FAN'S PERSONAL TWIST (honor this): ${req.customNote.trim().slice(0, 280)}`);
  }
  if (req.cast.length > 0) {
    parts.push(
      "CANON CHARACTERS TO USE (keep these looks):\n" +
        req.cast.map((c) => `- ${c.name}: ${c.look}`).join("\n")
    );
  }
  parts.push(`DIALOGUE LANGUAGE: ${req.language}`);
  parts.push(`Write the ${ENDING_PANEL_COUNT}-panel fan ending now.`);

  return { system, user: parts.join("\n\n") };
}

/** Shape-check the model's script into exactly ENDING_PANEL_COUNT panels. */
export function normalizeEndingScript(parsed: unknown): EndingScript {
  const p = (parsed ?? {}) as Record<string, unknown>;
  const clamp = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  const rawTitle = (p.title ?? {}) as Record<string, unknown>;
  const title = { en: clamp(rawTitle.en, 80) || "Fan Ending", sub: clamp(rawTitle.sub, 120) };

  const cast: StudioCastMember[] = (Array.isArray(p.cast) ? p.cast.slice(0, 4) : [])
    .map((c) => (c && typeof c === "object" ? (c as Record<string, unknown>) : null))
    .map((c) => (c ? { name: clamp(c.name, 40), look: clamp(c.look, 240) } : null))
    .filter((c): c is StudioCastMember => !!c && !!c.look);

  const KINDS = ["speech", "thought", "narration", "sfx"];
  const panels: StudioPanelScript[] = (Array.isArray(p.panels) ? p.panels : [])
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const scene = clamp(raw.scene, 500);
      if (!scene) return null;
      const lines: MangaLine[] = (Array.isArray(raw.lines) ? raw.lines : [])
        .slice(0, MAX_ENDING_LINES_PER_PANEL)
        .map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>) : null))
        .map((l) => {
          if (!l) return null;
          const text = clamp(l.text, MAX_ENDING_LINE_LEN);
          if (!text) return null;
          const kind = KINDS.includes(l.kind as string) ? (l.kind as MangaLine["kind"]) : "speech";
          const speaker = kind === "narration" || kind === "sfx" ? "" : clamp(l.speaker, 40);
          return { kind, speaker, text };
        })
        .filter((l): l is MangaLine => l !== null);
      return { scene, lines };
    })
    .filter((x): x is StudioPanelScript => x !== null)
    .slice(0, ENDING_PANEL_COUNT);

  if (panels.length < ENDING_PANEL_COUNT) throw new Error("ending_bad_script");
  return { title, logline: clamp(p.logline, 240), cast, panels };
}

// ── Panel image prompt ─────────────────────────────────────────────────────
// THE key difference from Studio: dialogue is hand-lettered INTO the image,
// and the prompt explicitly frames the work as unofficial fan art so the
// characters are drawn faithful to their famous official designs.

function bubbleInstruction(line: MangaLine): string {
  const text = line.text.replace(/"/g, "'");
  switch (line.kind) {
    case "thought":
      return `A cloud-shaped thought bubble${line.speaker ? ` near ${line.speaker}` : ""} reading exactly: "${text}"`;
    case "narration":
      return `A rectangular narration caption box reading exactly: "${text}"`;
    case "sfx":
      return `Large dynamic onomatopoeia sound-effect lettering integrated into the art, reading exactly: "${text}"`;
    default:
      return `A white speech bubble with a tail pointing to ${line.speaker || "the speaking character"}, reading exactly: "${text}"`;
  }
}

export function buildEndingPanelPrompt(opts: {
  styleKey: StyleKey;
  seriesTitle: string;
  panelIndex: number;
  scene: string;
  cast: StudioCastMember[];
  lines: MangaLine[];
}): string {
  const { styleKey, seriesTitle, panelIndex, scene, cast, lines } = opts;
  const family = STYLE_FAMILIES[styleKey] ?? STYLE_FAMILIES.slayer;

  const castClause =
    cast.length > 0
      ? `Characters in this panel — draw each one faithful to their iconic, well-known official ${seriesTitle} design so fans recognize them instantly: ` +
        cast.map((c) => `${c.name} (${c.look})`).join("; ") +
        ". "
      : "";

  const lettering =
    lines.length > 0
      ? "Hand-letter the manga dialogue INTO the artwork with professional comic lettering. " +
        "Include EXACTLY this text, spelled exactly as written, and no other text:\n" +
        lines.map((l) => `- ${bubbleInstruction(l)}`).join("\n") +
        "\nSpeech bubbles are clean white with a crisp black outline; the lettering is bold, " +
        "large, and perfectly readable. Do not add any other words, captions, signatures, or " +
        "watermarks anywhere in the image. "
      : "No text, no letters, no speech balloons, no watermarks anywhere in the image. ";

  return (
    `Unofficial FAN ART tribute: one breathtaking full-color manga panel — page ${panelIndex + 1} of ` +
    `${ENDING_PANEL_COUNT} from a fan-made epilogue chapter of "${seriesTitle}", drawn by a devoted ` +
    "fan in the doujinshi tradition of fandom creative play. " +
    `${family.style} ` +
    castClause +
    `Scene: ${scene} ` +
    lettering +
    "Dramatic cinematic composition, dynamic camera angle, rich atmospheric lighting, detailed " +
    "background, expressive faces, ink-and-screentone flourishes. Masterpiece quality — the kind " +
    "of page fans screenshot and share."
  );
}
