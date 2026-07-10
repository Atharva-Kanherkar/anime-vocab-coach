"use client";

// Manga Studio — the creative manga maker. Flow:
//   1. compose — a concept (premise), genre, tone, setting, dialogue language,
//                art style, and optionally your own characters
//   2. edit    — the AI drafts a chapter; you edit the title/logline/cast, tweak
//                every panel's dialogue (speech / thought / narration / SFX),
//                add/reorder/delete panels, redraw art, or hand-draw a sketch the
//                AI beautifies into your style
//   3. saved   — read the finished chapter and publish it to the free gallery
// Runs on the public /studio page AND inside /app. Logged-out visitors get one
// free manga held in this browser; saving/publishing needs a (free) sign-in,
// after which the in-progress draft is restored and saved to the account.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LINE_KINDS,
  MAX_CHARACTERS,
  MAX_LINES_PER_PANEL,
  MAX_PREMISE_LEN,
  MAX_STUDIO_PANELS,
  STUDIO_GENRES,
  STUDIO_LANGUAGES,
  STUDIO_STYLES,
  STUDIO_TONES,
  studioStyleLabel,
  type LineKind,
  type MangaLine,
  type StudioCastMember,
  type StudioCreationMeta,
  type StudioIndexEntry,
  type StudioPanelScript,
} from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";
import {
  clearDraft,
  loadDraft,
  newDraftFromScript,
  panelsMissingArt,
  saveDraft,
  updateLine,
  type DraftPanel,
  type StudioDraft,
} from "@/lib/studio-draft";
import { SketchCanvas, type SketchHandle } from "@/components/app/sketch-canvas";
import { StudioReaderView } from "@/components/app/studio-reader";
import { DesktopChromeBanner } from "@/components/desktop-chrome-banner";
import { trackMetaCustom } from "@/lib/meta-pixel";

type Auth = "unknown" | "in" | "out";

const ERROR_COPY: Record<string, string> = {
  ai_not_configured: "The studio isn't configured on this deployment yet. Try again later.",
  empty_concept: "Give a concept or pick a genre first.",
  anon_draft_limit: "You've used your free tries for today. Sign in (free) to keep creating.",
  anon_art_limit: "You've used your free art for today. Sign in (free) to draw more.",
  art_quota_exhausted: "You've used all your art for this month — more unlocks next month.",
  studio_quota_exhausted: "You've saved all your free mangas this month — more unlock next month.",
  too_few_panels: "A chapter needs at least a few panels.",
  unauthorized: "Sign in (free) to save your manga.",
};
function errorMessage(code: string): string {
  return ERROR_COPY[code] ?? "Something went wrong — nothing was used up. Try again.";
}

function signInHref(): string {
  if (typeof window === "undefined") return "/sign-in";
  const back = window.location.pathname + window.location.hash;
  return `/sign-in?redirect_url=${encodeURIComponent(back || "/studio")}`;
}

const LINE_META: Record<LineKind, { label: string; hasSpeaker: boolean }> = {
  speech: { label: "💬 Speech", hasSpeaker: true },
  thought: { label: "💭 Thought", hasSpeaker: true },
  narration: { label: "📖 Narration", hasSpeaker: false },
  sfx: { label: "💥 SFX", hasSpeaker: false },
};

function emptyLine(): MangaLine {
  return { kind: "speech", speaker: "", text: "" };
}

export function StudioEditor({ signedIn }: { signedIn?: boolean }) {
  // Server-resolved sign-in is authoritative for the UI; the list fetch only
  // confirms/populates. This is why a logged-in user never sees "log in to save".
  const [auth, setAuth] = useState<Auth>(signedIn === undefined ? "unknown" : signedIn ? "in" : "out");
  const [entries, setEntries] = useState<StudioIndexEntry[]>([]);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [saved, setSaved] = useState<StudioCreationMeta | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/studio");
      if (res.status === 401) {
        // Trust a server-provided signedIn=true over a transient 401.
        if (signedIn !== true) setAuth("out");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { creations: StudioIndexEntry[] };
      setAuth("in");
      setEntries(data.creations);
    } catch {
      // Offline: keep whatever auth we already have; the composer still works.
    }
  }, [signedIn]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshList();
      const restored = loadDraft();
      if (restored) setDraft(restored);
      if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "ending") {
        trackMetaCustom("StudioOpen", { source: "ending_redirect" });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [refreshList]);

  const mutateDraft = useCallback((updater: (d: StudioDraft) => StudioDraft) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = updater(cur);
      saveDraft(next);
      return next;
    });
  }, []);

  const openSaved = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/studio/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { creation: StudioCreationMeta };
      setSaved(data.creation);
      setDraft(null);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoadingId(null);
    }
  }, []);

  if (saved) {
    return (
      <SavedManga
        meta={saved}
        canManage={auth === "in"}
        onBack={() => {
          setSaved(null);
          void refreshList();
        }}
        onChanged={(m) => setSaved(m)}
        onDeleted={() => {
          setSaved(null);
          void refreshList();
        }}
      />
    );
  }

  if (draft) {
    return (
      <EditDraft
        draft={draft}
        auth={auth}
        onMutate={mutateDraft}
        onDiscard={() => {
          clearDraft();
          setDraft(null);
        }}
        onSaved={(m) => {
          clearDraft();
          setDraft(null);
          setSaved(m);
          void refreshList();
        }}
        showChromeNudge
      />
    );
  }

  return (
    <section aria-label="Manga Studio">
      <header>
        <p className="av-eyebrow">Manga Studio · 創作</p>
        <h1 className="mt-2 font-jpround text-[clamp(28px,5vw,46px)] font-black leading-[1.05]">
          Create your own manga
        </h1>
        <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-ink2">
          Describe your story, pick a genre and art style, and the AI storyboards a whole chapter —
          cast, panels, and dialogue. Then <b className="text-accent">rewrite any line, add or reorder
          panels, redraw a panel</b>, or <b className="text-accent">sketch it yourself and let the AI
          finish the art</b>. Publish to the gallery when it&apos;s ready. Free to try — no account
          needed.
        </p>
        {auth === "out" && (
          <p className="mt-3 rounded-lg border-2 border-line bg-panel px-4 py-2.5 text-[13px] font-bold text-ink2">
            Try it free — no account needed. Sign in (also free) to save, publish, and make more.{" "}
            <a className="text-accent underline" href="/end/lantern-of-words">
              Or choose an ending for a finished manga →
            </a>
          </p>
        )}
      </header>

      <Composer
        auth={auth}
        onDrafted={(script, base) => {
          const d = newDraftFromScript({ ...base, ...script });
          saveDraft(d);
          setDraft(d);
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />

      {auth === "in" && entries.length > 0 && (
        <section className="mt-12">
          <h2 className="av-eyebrow">Your mangas · 本棚</h2>
          <ul className="mt-3 grid list-none grid-cols-1 gap-2.5 pl-0 sm:grid-cols-2">
            {entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={loadingId === e.id}
                  onClick={() => void openSaved(e.id)}
                  className="av-card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-jpround text-[15px] font-black">{e.title.en}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink3">
                      {studioStyleLabel(e.styleKey)}
                      {e.genre ? ` · ${e.genre}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-extrabold text-ink3">
                    {e.isPublic ? "公開 · public" : "私用 · private"}
                  </span>
                  <span className="shrink-0 text-[12px] font-extrabold text-ink2">
                    {loadingId === e.id ? "…" : "読む →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

// ── Small building blocks ───────────────────────────────────────────────────

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: readonly T[];
  value: T | "";
  onChange: (v: T) => void;
  labelFor?: (v: T) => string;
}) {
  return (
    <ul className="mt-3 flex list-none flex-wrap gap-2 pl-0">
      {options.map((opt) => {
        const on = value === opt;
        return (
          <li key={opt}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt)}
              className={
                "rounded-full border-2 px-3.5 py-1.5 text-[12.5px] font-extrabold transition " +
                (on ? "border-ink bg-ink text-bg" : "border-line text-ink2 hover:text-ink")
              }
            >
              {labelFor ? labelFor(opt) : opt}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StepHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3 first:mt-0">
      {n} · {children}
    </h2>
  );
}

// ── Step 1: Composer ──────────────────────────────────────────────────────

function Composer({
  auth,
  onDrafted,
}: {
  auth: Auth;
  onDrafted: (
    script: {
      title: { en: string; sub: string };
      logline: string;
      cast: StudioCastMember[];
      panels: StudioPanelScript[];
    },
    base: { genre: string; tone: string; setting: string; language: string; styleKey: StyleKey }
  ) => void;
}) {
  const [premise, setPremise] = useState("");
  const [genre, setGenre] = useState<string>("");
  const [tone, setTone] = useState<string>("");
  const [setting, setSetting] = useState("");
  const [language, setLanguage] = useState<string>(STUDIO_LANGUAGES[0]);
  const [styleKey, setStyleKey] = useState<StyleKey>(STUDIO_STYLES[0]);
  const [cast, setCast] = useState<StudioCastMember[]>([]);
  const [charName, setCharName] = useState("");
  const [charLook, setCharLook] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const addChar = () => {
    const name = charName.trim();
    const look = charLook.trim();
    if (!look || cast.length >= MAX_CHARACTERS) return;
    setCast((cur) => [...cur, { name, look }]);
    setCharName("");
    setCharLook("");
  };

  const canDraft = premise.trim().length > 0 || genre.length > 0;

  const draft = async () => {
    if (!canDraft) {
      setError("empty_concept");
      return;
    }
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/studio/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ premise, genre, tone, setting, language, styleKey, characters: cast }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        title?: { en: string; sub: string };
        logline?: string;
        cast?: StudioCastMember[];
        panels?: StudioPanelScript[];
        error?: string;
        needsLogin?: boolean;
      };
      if (!res.ok || !data.panels) {
        setError(data.error ?? "failed");
        if (data.needsLogin) setNeedsLogin(true);
        return;
      }
      onDrafted(
        {
          title: data.title ?? { en: "Untitled", sub: "" },
          logline: data.logline ?? "",
          cast: data.cast ?? cast,
          panels: data.panels,
        },
        { genre, tone, setting, language, styleKey }
      );
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-card mt-8 p-5 sm:p-6">
      <StepHeading n={1}>What&apos;s your manga about?</StepHeading>
      <textarea
        value={premise}
        onChange={(e) => setPremise(e.target.value)}
        maxLength={MAX_PREMISE_LEN}
        rows={3}
        placeholder="A retired swordsman is pulled back for one last duel under a blood moon… (or just pick a genre and let the AI surprise you)"
        className="mt-3 w-full resize-y border-2 border-line bg-field px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-ink"
      />

      <StepHeading n={2}>Genre</StepHeading>
      <ChipRow options={STUDIO_GENRES} value={genre} onChange={(v) => setGenre(v === genre ? "" : v)} />

      <StepHeading n={3}>Tone</StepHeading>
      <ChipRow options={STUDIO_TONES} value={tone} onChange={(v) => setTone(v === tone ? "" : v)} />

      <StepHeading n={4}>Art style</StepHeading>
      <ChipRow options={STUDIO_STYLES} value={styleKey} onChange={setStyleKey} labelFor={studioStyleLabel} />

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <label className="block text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
          Setting <span className="normal-case tracking-normal">(optional)</span>
          <input
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="Neo-Tokyo, 2199"
            className="mt-2 w-full border-2 border-line bg-field px-3 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
          />
        </label>
        <div>
          <span className="block text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
            Dialogue language
          </span>
          <ChipRow options={STUDIO_LANGUAGES} value={language} onChange={setLanguage} />
        </div>
      </div>

      <StepHeading n={5}>Your characters <span className="normal-case tracking-normal">(optional — the AI invents them otherwise)</span></StepHeading>
      {cast.length > 0 && (
        <ul className="mt-3 flex list-none flex-wrap gap-2 pl-0">
          {cast.map((c, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-full border-2 border-line px-3 py-1 text-[12px] font-bold text-ink2"
            >
              <b className="text-ink">{c.name || "?"}</b>
              <span className="max-w-[22ch] truncate text-ink3">{c.look}</span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => setCast((cur) => cur.filter((_, k) => k !== i))}
                className="text-ink3 hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {cast.length < MAX_CHARACTERS && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={charName}
            onChange={(e) => setCharName(e.target.value)}
            placeholder="Name (Kaito)"
            className="w-36 border-2 border-line bg-field px-3 py-2 text-[13px] outline-none focus:border-ink"
          />
          <input
            value={charLook}
            onChange={(e) => setCharLook(e.target.value)}
            placeholder="Look (spiky white hair, red coat, scar over left eye)"
            className="min-w-[16rem] flex-1 border-2 border-line bg-field px-3 py-2 text-[13px] outline-none focus:border-ink"
          />
          <button type="button" onClick={addChar} className="av-btn av-btn-ghost">
            Add
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => void draft()} disabled={busy || !canDraft} className="av-btn av-btn-primary">
          {busy ? "Storyboarding your chapter…" : "✍️ Draft my chapter with AI"}
        </button>
        {busy && <span className="text-[12.5px] text-ink3">writing the cast and panels…</span>}
      </div>
      {error && (
        <div className="mt-3">
          <p className="text-[13px] font-bold text-danger">{errorMessage(error)}</p>
          {needsLogin && auth !== "in" && (
            <a href={signInHref()} className="av-btn av-btn-primary mt-2 inline-flex">
              Sign in — it&apos;s free
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Workspace — the "Cursor for manga" editor ──────────────────────
// Three panes: a panel timeline, a big center stage where you DRAW or view the
// art, and an AI copilot that suggests scenes/dialogue and drives generation.
// Draw and Generate are co-equal; the AI augments the author, never replaces.

function EditDraft({
  draft,
  auth,
  onMutate,
  onDiscard,
  onSaved,
  showChromeNudge = false,
}: {
  draft: StudioDraft;
  auth: Auth;
  onMutate: (updater: (d: StudioDraft) => StudioDraft) => void;
  onDiscard: () => void;
  onSaved: (meta: StudioCreationMeta) => void;
  showChromeNudge?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"result" | "canvas">("canvas");
  const [busy, setBusy] = useState(false);
  const [drawErr, setDrawErr] = useState<string | null>(null);
  const [drawNeedsLogin, setDrawNeedsLogin] = useState(false);
  const [assisting, setAssisting] = useState<"" | "scene" | "line">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const sketchRef = useRef<SketchHandle | null>(null);

  const count = draft.panels.length;
  const idx = Math.min(selected, count - 1);
  const panel = draft.panels[idx];
  const missing = panelsMissingArt(draft);

  const select = (i: number) => {
    setSelected(i);
    setDrawErr(null);
    setTab(draft.panels[i]?.image ? "result" : "canvas");
  };

  const setPanel = useCallback(
    (i: number, patch: Partial<DraftPanel>) =>
      onMutate((d) => ({ ...d, panels: d.panels.map((p, k) => (k === i ? { ...p, ...patch } : p)) })),
    [onMutate]
  );
  const movePanel = (i: number, dir: -1 | 1) =>
    onMutate((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.panels.length) return d;
      const panels = [...d.panels];
      [panels[i], panels[j]] = [panels[j], panels[i]];
      return { ...d, panels };
    });
  const deletePanel = (i: number) => {
    onMutate((d) => ({ ...d, panels: d.panels.filter((_, k) => k !== i) }));
    setSelected((s) => Math.max(0, s >= i ? s - 1 : s));
  };
  const addPanel = () => {
    onMutate((d) =>
      d.panels.length >= MAX_STUDIO_PANELS
        ? d
        : { ...d, panels: [...d.panels, { scene: "", lines: [emptyLine()], image: null }] }
    );
    setSelected(count); // new one is appended
    setTab("canvas");
  };
  const setCastMember = (i: number, patch: Partial<StudioCastMember>) =>
    onMutate((d) => ({ ...d, cast: d.cast.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));

  const draw = async (sketch?: string) => {
    setBusy(true);
    setDrawErr(null);
    setDrawNeedsLogin(false);
    try {
      const res = await fetch("/api/studio/panel-art", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styleKey: draft.styleKey, scene: panel.scene, cast: draft.cast, sketch }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: string; error?: string; needsLogin?: boolean };
      if (!res.ok || !data.image) {
        setDrawErr(data.error ?? "failed");
        if (data.needsLogin) setDrawNeedsLogin(true);
        return;
      }
      setPanel(idx, { image: data.image });
      setTab("result");
    } catch {
      setDrawErr("failed");
    } finally {
      setBusy(false);
    }
  };
  const beautify = () => {
    const url = sketchRef.current?.toDataUrl();
    if (!url) {
      setDrawErr("empty_panel");
      return;
    }
    void draw(url);
  };

  const assist = async (kind: "scene" | "line") => {
    setAssisting(kind);
    try {
      const res = await fetch("/api/studio/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          genre: draft.genre,
          tone: draft.tone,
          setting: draft.setting,
          title: draft.title.en,
          cast: draft.cast,
          scene: panel.scene,
          language: draft.language,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { suggestion?: string };
      const s = (data.suggestion ?? "").trim();
      if (!s) return;
      if (kind === "scene") setPanel(idx, { scene: panel.scene ? `${panel.scene} ${s}` : s });
      else if (panel.lines.length < MAX_LINES_PER_PANEL)
        setPanel(idx, { lines: [...panel.lines, { kind: "speech", speaker: draft.cast[0]?.name ?? "", text: s }] });
    } finally {
      setAssisting("");
    }
  };

  const save = async () => {
    if (auth !== "in") {
      saveDraft(draft);
      window.location.href = signInHref();
      return;
    }
    setSaving(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          logline: draft.logline,
          genre: draft.genre,
          tone: draft.tone,
          setting: draft.setting,
          language: draft.language,
          styleKey: draft.styleKey,
          cast: draft.cast,
          panels: draft.panels.map((p) => ({ scene: p.scene, lines: p.lines })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { creation?: StudioCreationMeta; error?: string };
      if (!res.ok || !data.creation) {
        setError(data.error ?? "failed");
        return;
      }
      const id = data.creation.id;
      await Promise.all(
        draft.panels.map((p, i) =>
          p.image
            ? fetch(`/api/studio/${id}/panel/${i}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ image: p.image }),
              }).catch(() => null)
            : Promise.resolve(null)
        )
      );
      onSaved(data.creation);
    } catch {
      setError("failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Manga workspace" className="pb-28">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b-2 border-ink pb-3">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
        >
          ← Start over
        </button>
        <input
          value={draft.title.en}
          onChange={(e) => onMutate((d) => ({ ...d, title: { ...d.title, en: e.target.value } }))}
          aria-label="Manga title"
          placeholder="Untitled"
          className="min-w-[8rem] flex-1 bg-transparent font-jpround text-[clamp(18px,2.4vw,26px)] font-black leading-tight outline-none"
        />
        <span className="text-[12px] font-bold text-ink3">
          {count - missing}/{count} drawn
        </span>
        <button type="button" onClick={() => void save()} disabled={saving} className="av-btn av-btn-primary">
          {saving ? "Saving…" : auth === "in" ? "Save & publish" : "Log in to save"}
        </button>
      </div>
      {auth === "out" && (
        <p className="mt-3 rounded-xl border-2 border-accent/35 bg-panel px-4 py-3 text-[13.5px] font-bold text-ink2">
          Your epilogue is drafted. Draw panels, then{" "}
          <a className="text-accent underline" href={signInHref()}>
            sign in free to save &amp; share
          </a>
          .
        </p>
      )}
      {error && (
        <div className="mt-2">
          <span className="text-[13px] font-bold text-danger">{errorMessage(error)}</span>
          {needsLogin && (
            <a href={signInHref()} className="ml-2 text-[13px] font-extrabold text-accent underline">
              Sign in
            </a>
          )}
        </div>
      )}

      {/* 3-pane workspace */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[132px_minmax(0,1fr)_360px]">
        {/* Timeline */}
        <aside className="order-2 lg:order-none">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {draft.panels.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
                aria-current={i === idx}
                className={
                  "relative aspect-square w-24 shrink-0 overflow-hidden border-2 transition lg:w-full " +
                  (i === idx ? "border-accent" : "border-line hover:border-ink")
                }
              >
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center bg-panel text-[11px] font-bold text-ink3">
                    empty
                  </span>
                )}
                <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-bg/90 text-[10px] font-black">
                  {i + 1}
                </span>
              </button>
            ))}
            {count < MAX_STUDIO_PANELS && (
              <button
                type="button"
                onClick={addPanel}
                className="grid aspect-square w-24 shrink-0 place-items-center border-2 border-dashed border-line text-[22px] font-black text-ink3 hover:text-ink lg:w-full"
                aria-label="Add panel"
              >
                +
              </button>
            )}
          </div>
        </aside>

        {/* Stage */}
        <div className="order-1 lg:order-none">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border-2 border-line">
              {(["canvas", "result"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={
                    "px-4 py-1.5 text-[12.5px] font-extrabold transition " +
                    (tab === t ? "bg-ink text-bg" : "text-ink2 hover:text-ink")
                  }
                >
                  {t === "canvas" ? "✏️ Draw" : "🖼 Art"}
                </button>
              ))}
            </div>
            <span className="text-[12px] font-bold text-ink3">Panel {idx + 1} of {count}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label="Move panel earlier"
                disabled={idx === 0}
                onClick={() => movePanel(idx, -1)}
                className="grid h-7 w-7 place-items-center rounded border-2 border-line text-ink2 disabled:opacity-30 hover:text-ink"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="Move panel later"
                disabled={idx === count - 1}
                onClick={() => movePanel(idx, 1)}
                className="grid h-7 w-7 place-items-center rounded border-2 border-line text-ink2 disabled:opacity-30 hover:text-ink"
              >
                →
              </button>
              <button
                type="button"
                aria-label="Delete panel"
                disabled={count <= 1}
                onClick={() => deletePanel(idx)}
                className="grid h-7 w-7 place-items-center rounded border-2 border-line text-ink3 disabled:opacity-30 hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-3 rounded-lg border-2 border-ink bg-panel p-3">
            {tab === "canvas" ? (
              <div>
                <SketchCanvas key={idx} ref={sketchRef} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={beautify} disabled={busy} className="av-btn av-btn-primary">
                    {busy ? "Beautifying…" : "✨ Turn my drawing into art"}
                  </button>
                  <span className="text-[12px] text-ink3">The AI inks &amp; colors YOUR sketch in the {studioStyleLabel(draft.styleKey)} style.</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid min-h-[300px] place-items-center bg-bg">
                  {panel.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL
                    <img
                      src={panel.image}
                      alt={`Panel ${idx + 1}`}
                      className="mx-auto block max-h-[62vh] w-auto max-w-full"
                    />
                  ) : (
                    <p className="p-8 text-center text-[13px] font-bold text-ink3">
                      {busy ? "Drawing…" : "No art yet — draw it, or generate from the scene."}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void draw()} disabled={busy} className="av-btn av-btn-primary">
                    {busy ? "Generating…" : panel.image ? "↻ Regenerate from scene" : "🎨 Generate from scene"}
                  </button>
                </div>
              </div>
            )}
            {drawErr && (
              <div className="mt-2">
                <span className="text-[12.5px] font-bold text-danger">{errorMessage(drawErr)}</span>
                {drawNeedsLogin && (
                  <a href={signInHref()} className="ml-2 text-[12.5px] font-extrabold text-accent underline">
                    Sign in
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Copilot */}
        <aside className="order-3 lg:order-none">
          <div className="space-y-4 rounded-lg border-2 border-line p-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">Scene</h3>
                <button
                  type="button"
                  onClick={() => void assist("scene")}
                  disabled={assisting !== ""}
                  className="text-[11.5px] font-extrabold text-accent hover:underline disabled:opacity-50"
                >
                  {assisting === "scene" ? "…" : "✨ Suggest"}
                </button>
              </div>
              <textarea
                value={panel.scene}
                onChange={(e) => setPanel(idx, { scene: e.target.value })}
                rows={3}
                placeholder="What happens in this panel? (drawn or generated art uses this)"
                className="mt-2 w-full resize-y border-2 border-line bg-field px-2.5 py-1.5 text-[12.5px] leading-snug outline-none focus:border-ink"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">Dialogue</h3>
                <button
                  type="button"
                  onClick={() => void assist("line")}
                  disabled={assisting !== "" || panel.lines.length >= MAX_LINES_PER_PANEL}
                  className="text-[11.5px] font-extrabold text-accent hover:underline disabled:opacity-50"
                >
                  {assisting === "line" ? "…" : "✨ Suggest"}
                </button>
              </div>
              <div className="mt-2 space-y-2.5">
                {panel.lines.map((line, j) => (
                  <div key={j} className="rounded-md border-2 border-line p-2">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      {LINE_KINDS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={line.kind === k}
                          onClick={() =>
                            setPanel(idx, {
                              lines: updateLine(panel.lines, j, {
                                kind: k,
                                speaker: LINE_META[k].hasSpeaker ? line.speaker : "",
                              }),
                            })
                          }
                          className={
                            "rounded-full border px-1.5 py-0.5 text-[10px] font-extrabold transition " +
                            (line.kind === k ? "border-ink bg-ink text-bg" : "border-line text-ink3 hover:text-ink")
                          }
                        >
                          {LINE_META[k].label}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="Remove line"
                        onClick={() => setPanel(idx, { lines: panel.lines.filter((_, k) => k !== j) })}
                        className="ml-auto text-[12px] text-ink3 hover:text-danger"
                      >
                        ✕
                      </button>
                    </div>
                    {LINE_META[line.kind].hasSpeaker && (
                      <input
                        value={line.speaker}
                        onChange={(e) => setPanel(idx, { lines: updateLine(panel.lines, j, { speaker: e.target.value }) })}
                        placeholder="Speaker"
                        className="mb-1 w-28 border-b border-line bg-transparent pb-0.5 text-[11px] font-black text-accent outline-none focus:border-ink"
                      />
                    )}
                    <input
                      value={line.text}
                      onChange={(e) => setPanel(idx, { lines: updateLine(panel.lines, j, { text: e.target.value }) })}
                      placeholder={line.kind === "sfx" ? "BOOM" : line.kind === "narration" ? "Caption…" : "Line…"}
                      className="w-full border-b border-line bg-transparent pb-0.5 text-[13px] outline-none focus:border-ink"
                    />
                  </div>
                ))}
                {panel.lines.length < MAX_LINES_PER_PANEL && (
                  <button
                    type="button"
                    onClick={() => setPanel(idx, { lines: [...panel.lines, emptyLine()] })}
                    className="text-[12px] font-extrabold text-ink3 hover:text-ink"
                  >
                    + Add line
                  </button>
                )}
              </div>
            </div>

            {draft.cast.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer list-none text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
                  Cast &amp; story ▾
                </summary>
                <div className="mt-2 space-y-2">
                  <input
                    value={draft.logline}
                    onChange={(e) => onMutate((d) => ({ ...d, logline: e.target.value }))}
                    placeholder="Logline"
                    className="w-full border-2 border-line bg-field px-2.5 py-1.5 text-[12px] italic outline-none focus:border-ink"
                  />
                  {draft.cast.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1.5">
                      <input
                        value={c.name}
                        onChange={(e) => setCastMember(i, { name: e.target.value })}
                        placeholder="Name"
                        className="w-24 border-2 border-line bg-field px-2 py-1 text-[12px] font-bold outline-none focus:border-ink"
                      />
                      <input
                        value={c.look}
                        onChange={(e) => setCastMember(i, { look: e.target.value })}
                        placeholder="Look (kept consistent)"
                        className="min-w-[10rem] flex-1 border-2 border-line bg-field px-2 py-1 text-[11.5px] outline-none focus:border-ink"
                      />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
          {auth !== "in" && (
            <p className="mt-2 text-[11.5px] text-ink3">Kept in this browser until you sign in (free) to save &amp; publish.</p>
          )}
        </aside>
      </div>
      {showChromeNudge && <DesktopChromeBanner />}
    </section>
  );
}


// ── Step 3: Saved manga (read + share) ─────────────────────────────────────

function SavedManga({
  meta,
  canManage,
  onBack,
  onChanged,
  onDeleted,
}: {
  meta: StudioCreationMeta;
  canManage: boolean;
  onBack: () => void;
  onChanged: (meta: StudioCreationMeta) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelImageUrls = useMemo(
    () => meta.panels.map((_, i) => `/api/studio/${meta.id}/panel/${i}`),
    [meta.id, meta.panels]
  );

  const toggleShare = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/${meta.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ public: !meta.isPublic }),
      });
      if (res.ok) {
        const data = (await res.json()) as { creation: StudioCreationMeta };
        onChanged(data.creation);
      }
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/m/${meta.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied — the visible URL below still lets them copy by hand.
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this manga? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/${meta.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Your manga">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
      >
        ← Studio
      </button>

      <div className="mt-4">
        <StudioReaderView
          meta={meta}
          imageUrl={`/api/studio/${meta.id}/image`}
          panelImageUrls={panelImageUrls}
          footer={
            canManage ? (
              <>
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                  <button type="button" onClick={() => void toggleShare()} disabled={busy} className="av-btn av-btn-ghost">
                    {meta.isPublic ? "Make private" : "Publish to gallery"}
                  </button>
                  {meta.isPublic && (
                    <button type="button" onClick={() => void copyLink()} className="av-btn av-btn-quiet">
                      {copied ? "Copied ✓" : "Copy public link"}
                    </button>
                  )}
                  <button type="button" onClick={() => void remove()} disabled={busy} className="av-btn av-btn-quiet">
                    Delete
                  </button>
                </div>
                {meta.isPublic && (
                  <p className="mt-2 break-all text-[12px] text-ink3">Public — in the gallery and at /m/{meta.id}</p>
                )}
              </>
            ) : null
          }
        />
      </div>
    </section>
  );
}
