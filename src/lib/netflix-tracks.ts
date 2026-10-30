/**
 * Netflix's own subtitle tracks, read the way its player reads them.
 *
 * The player's manifest lists every subtitle language licensed in the
 * learner's region, each with download URLs for one or more text formats.
 * Reading the Japanese and (when there is one) English track straight from
 * there gives dual subtitles with the official timing, ahead of time, instead
 * of reading whichever single line the player happens to have on screen.
 *
 * Pure: no DOM, no chrome.*, so the page script, the content script and the
 * tests share it. TTML is parsed with a small tokenizer for the subset
 * Netflix uses (IMSC 1.1 / DFXP: <p begin end>, <span>, <br/>, ruby).
 */

export interface TimedCue {
  /** Seconds. */
  start: number;
  end: number;
  /** The line as read, furigana left out. */
  text: string;
  /** Furigana from the track: [written, reading]. */
  ruby: [string, string][];
}

export interface NetflixTrack {
  language: string;
  /** "subtitles" or "closedcaptions" (the latter adds sound descriptions). */
  kind: string;
  forced: boolean;
  none: boolean;
  downloads: { format: string; url: string }[];
}

/** Text formats, best first. Image formats (nflx-cmisc) cannot be read. */
export const TEXT_FORMATS = ["webvtt-lssdh-ios8", "imsc1.1", "dfxp-ls-sdh", "simplesdh"] as const;

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function downloadsOf(tt: Record<string, unknown>): { format: string; url: string }[] {
  const out: { format: string; url: string }[] = [];
  const dls = tt.ttDownloadables;
  if (!obj(dls)) return out;
  for (const [format, dl] of Object.entries(dls)) {
    if (!obj(dl)) continue;
    let url: unknown;
    if (Array.isArray(dl.urls)) url = (dl.urls.find((u) => obj(u) && typeof u.url === "string") as { url?: string } | undefined)?.url;
    if (!url && obj(dl.downloadUrls)) url = Object.values(dl.downloadUrls).find((u) => typeof u === "string");
    if (typeof url === "string" && /^https:\/\//.test(url)) out.push({ format, url });
  }
  return out;
}

/** The subtitle tracks in a parsed player response, wherever they sit in it. */
export function findTimedTextTracks(value: unknown): { movieId: string; tracks: NetflixTrack[] } | null {
  const queue: { v: unknown; depth: number; movieId?: unknown }[] = [{ v: value, depth: 0 }];
  while (queue.length) {
    const { v, depth, movieId } = queue.shift()!;
    if (!obj(v)) continue;
    const id = v.movieId ?? movieId;
    if (Array.isArray(v.timedtexttracks)) {
      if (typeof id !== "string" && typeof id !== "number") return null;
      const tracks: NetflixTrack[] = [];
      for (const tt of v.timedtexttracks) {
        if (!obj(tt)) continue;
        const language = typeof tt.language === "string" ? tt.language : typeof tt.bcp47 === "string" ? tt.bcp47 : "";
        tracks.push({
          language,
          kind: typeof tt.rawTrackType === "string" ? tt.rawTrackType : typeof tt.trackType === "string" ? tt.trackType.toLowerCase() : "",
          forced: tt.isForcedNarrative === true,
          none: tt.isNoneTrack === true,
          downloads: downloadsOf(tt),
        });
      }
      return { movieId: String(id), tracks };
    }
    if (depth < 3) for (const child of Object.values(v)) if (obj(child)) queue.push({ v: child, depth: depth + 1, movieId: id });
  }
  return null;
}

/** The best readable track in a language: real subtitles over captions with
 * sound descriptions, never forced-narrative or "off" tracks. */
export function pickTrack(tracks: NetflixTrack[], lang: "ja" | "en"): { format: string; url: string } | null {
  const ranked = tracks
    .filter((t) => (t.language === lang || t.language.startsWith(lang + "-")) && !t.forced && !t.none)
    .sort((a, b) => Number(a.kind === "closedcaptions") - Number(b.kind === "closedcaptions"));
  for (const track of ranked) {
    for (const format of TEXT_FORMATS) {
      const dl = track.downloads.find((d) => d.format === format);
      if (dl) return dl;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Timing

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

interface TimeBase { tickRate: number; frameRate: number }

/** A TTML time expression in seconds, or NaN. */
export function ttmlTime(expr: string | undefined, base: TimeBase): number {
  if (!expr) return NaN;
  const s = expr.trim();
  let m = /^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/.exec(s);
  if (m) {
    const n = parseFloat(m[1]);
    return m[2] === "h" ? n * 3600 : m[2] === "m" ? n * 60 : m[2] === "s" ? n : m[2] === "ms" ? n / 1000 : m[2] === "f" ? n / base.frameRate : n / base.tickRate;
  }
  m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+(?:\.\d+)?))?$/.exec(s);
  if (m) {
    const secs = +m[1] * 3600 + +m[2] * 60 + +m[3];
    if (m[4]) return secs + parseFloat("0." + m[4]);
    if (m[5]) return secs + parseFloat(m[5]) / base.frameRate;
    return secs;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// TTML (IMSC 1.1, DFXP)

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1]] = decode(m[3] ?? m[4] ?? "");
  return out;
}
const local = (name: string) => name.slice(name.indexOf(":") + 1);
function attr(a: Record<string, string>, name: string): string | undefined {
  for (const [k, v] of Object.entries(a)) if (local(k) === name) return v;
  return undefined;
}

type RubyRole = "container" | "base" | "baseContainer" | "text" | "textContainer" | "delimiter" | "";

export function parseTtml(xml: string): TimedCue[] {
  const head = /<tt\b([^>]*)>/.exec(xml);
  const ttAttrs = head ? attrs(head[1]) : {};
  const frameRate = parseFloat(attr(ttAttrs, "frameRate") || "30") || 30;
  const mult = (attr(ttAttrs, "frameRateMultiplier") || "1 1").split(/\s+/).map(Number);
  const base: TimeBase = {
    tickRate: parseFloat(attr(ttAttrs, "tickRate") || "") || frameRate * (mult[0] / (mult[1] || 1)),
    frameRate: frameRate * (mult[0] / (mult[1] || 1)),
  };
  // Styles may carry the ruby role: <style xml:id="rb" tts:ruby="base"/>.
  const styleRuby = new Map<string, RubyRole>();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?style\b([^>]*)\/?>/g)) {
    const a = attrs(m[1]);
    const id = attr(a, "id");
    const ruby = attr(a, "ruby") as RubyRole | undefined;
    if (id && ruby) styleRuby.set(id, ruby);
  }
  const body = xml.slice(xml.search(/<(?:[\w-]+:)?body\b/) >= 0 ? xml.search(/<(?:[\w-]+:)?body\b/) : 0);
  const cues: TimedCue[] = [];
  for (const p of body.matchAll(/<(?:[\w-]+:)?p\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?p>/g)) {
    const a = attrs(p[1]);
    const start = ttmlTime(attr(a, "begin"), base);
    let end = ttmlTime(attr(a, "end"), base);
    if (!Number.isFinite(end)) end = start + (ttmlTime(attr(a, "dur"), base) || 0);
    if (!Number.isFinite(start) || !(end > start)) continue;
    // Walk the cue's spans, keeping a stack of ruby roles.
    const stack: RubyRole[] = [];
    let text = "";
    let rubyBase = "";
    let rubyText = "";
    const ruby: [string, string][] = [];
    for (const t of p[2].matchAll(/<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g)) {
      if (t[5] !== undefined) {
        const chunk = decode(t[5]).replace(/\s+/g, " ");
        const role = [...stack].reverse().find((r) => r) ?? "";
        if (role === "text" || role === "textContainer") rubyText += chunk;
        else if (role === "delimiter") continue;
        else {
          text += chunk;
          if (role === "base" || role === "baseContainer") rubyBase += chunk;
        }
        continue;
      }
      const name = local(t[2]);
      if (name === "br") { text += " "; continue; }
      if (name !== "span") continue;
      if (t[1]) {
        const role = stack.pop();
        if (role === "container" && rubyBase.trim() && rubyText.trim()) {
          ruby.push([rubyBase.trim(), rubyText.trim()]);
          rubyBase = rubyText = "";
        }
      } else {
        const sa = attrs(t[3]);
        const role = (attr(sa, "ruby") as RubyRole | undefined) ?? styleRuby.get((attr(sa, "style") ?? "").split(/\s+/)[0]) ?? "";
        if (!t[4]) stack.push(role);
        if (role === "container") rubyBase = rubyText = "";
      }
    }
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) cues.push({ start, end, text: clean, ruby });
  }
  return cues.sort((x, y) => x.start - y.start);
}

// ---------------------------------------------------------------------------
// WebVTT

export function parseVtt(vtt: string): TimedCue[] {
  const cues: TimedCue[] = [];
  const time = (s: string) => {
    const m = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})/.exec(s.trim());
    return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : NaN;
  };
  for (const block of vtt.replace(/\r/g, "").split(/\n{2,}/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [a, b] = lines[at].split("-->");
    const start = time(a), end = time(b);
    if (!Number.isFinite(start) || !(end > start)) continue;
    const raw = lines.slice(at + 1).join(" ");
    const ruby: [string, string][] = [];
    for (const m of raw.matchAll(/<ruby>([\s\S]*?)<rt>([\s\S]*?)<\/rt>\s*<\/ruby>/g)) {
      const written = decode(m[1].replace(/<[^>]+>/g, "")).trim();
      const reading = decode(m[2].replace(/<[^>]+>/g, "")).trim();
      if (written && reading) ruby.push([written, reading]);
    }
    const text = decode(raw.replace(/<rt>[\s\S]*?<\/rt>/g, "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    if (text) cues.push({ start, end, text, ruby });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function parseTimedText(text: string): TimedCue[] {
  return /^﻿?WEBVTT/.test(text) ? parseVtt(text) : parseTtml(text);
}

// ---------------------------------------------------------------------------
// Using the tracks

/** Index of the cue on screen at `t`, or -1. Cues are sorted by start. */
export function cueAt(cues: TimedCue[], t: number): number {
  let lo = 0, hi = cues.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  // Overlapping cues: the latest one that has started and not ended.
  for (let i = found; i >= 0 && i > found - 4; i--) if (t < cues[i].end) return i;
  return -1;
}

/** The English for each Japanese cue: the English cues it overlaps most,
 * in order. Empty where the English track says nothing (songs, signs). */
export function englishFor(ja: TimedCue[], en: TimedCue[]): string[] {
  return ja.map((cue) => {
    const len = cue.end - cue.start;
    const parts = en.filter((e) => {
      const overlap = Math.min(e.end, cue.end) - Math.max(e.start, cue.start);
      return overlap > 0 && (overlap >= 0.4 * len || overlap >= 0.4 * (e.end - e.start));
    });
    return parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
  });
}

/** Chunk indexes in the order to translate them: the one playing now first,
 * then what comes next, then what came before. */
export function chunkOrder(chunks: number, current: number): number[] {
  const now = Math.min(Math.max(current, 0), Math.max(chunks - 1, 0));
  const out: number[] = [];
  for (let i = now; i < chunks; i++) out.push(i);
  for (let i = now - 1; i >= 0; i--) out.push(i);
  return out;
}
