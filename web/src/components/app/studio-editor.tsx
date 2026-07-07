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

export function StudioEditor() {
  const [auth, setAuth] = useState<Auth>("unknown");
  const [entries, setEntries] = useState<StudioIndexEntry[]>([]);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [saved, setSaved] = useState<StudioCreationMeta | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/studio");
      if (res.status === 401) {
        setAuth("out");
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as { creations: StudioIndexEntry[] };
      setAuth("in");
      setEntries(data.creations);
    } catch {
      // Offline: leave auth unknown; the composer still works optimistically.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshList();
      const restored = loadDraft();
      if (restored) setDraft(restored);
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
            Try it free — no account needed. Sign in (also free) to save, publish, and make more.
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

// ── Step 2: Edit the drafted chapter ───────────────────────────────────────

function EditDraft({
  draft,
  auth,
  onMutate,
  onDiscard,
  onSaved,
}: {
  draft: StudioDraft;
  auth: Auth;
  onMutate: (updater: (d: StudioDraft) => StudioDraft) => void;
  onDiscard: () => void;
  onSaved: (meta: StudioCreationMeta) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const missing = panelsMissingArt(draft);
  const drawnCount = draft.panels.length - missing;

  const setPanel = useCallback(
    (i: number, patch: Partial<DraftPanel>) =>
      onMutate((d) => ({ ...d, panels: d.panels.map((p, k) => (k === i ? { ...p, ...patch } : p)) })),
    [onMutate]
  );
  const movePanel = useCallback(
    (i: number, dir: -1 | 1) =>
      onMutate((d) => {
        const j = i + dir;
        if (j < 0 || j >= d.panels.length) return d;
        const panels = [...d.panels];
        [panels[i], panels[j]] = [panels[j], panels[i]];
        return { ...d, panels };
      }),
    [onMutate]
  );
  const deletePanel = useCallback(
    (i: number) => onMutate((d) => ({ ...d, panels: d.panels.filter((_, k) => k !== i) })),
    [onMutate]
  );
  const addPanel = useCallback(
    () =>
      onMutate((d) =>
        d.panels.length >= MAX_STUDIO_PANELS
          ? d
          : { ...d, panels: [...d.panels, { scene: "", lines: [emptyLine()], image: null }] }
      ),
    [onMutate]
  );
  const setCastMember = useCallback(
    (i: number, patch: Partial<StudioCastMember>) =>
      onMutate((d) => ({ ...d, cast: d.cast.map((c, k) => (k === i ? { ...c, ...patch } : c)) })),
    [onMutate]
  );

  const drawPanel = useCallback(
    async (i: number, sketch?: string): Promise<{ ok: boolean; error?: string; needsLogin?: boolean }> => {
      const panel = draft.panels[i];
      const res = await fetch("/api/studio/panel-art", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styleKey: draft.styleKey, scene: panel.scene, cast: draft.cast, sketch }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: string; error?: string; needsLogin?: boolean };
      if (!res.ok || !data.image) return { ok: false, error: data.error ?? "failed", needsLogin: data.needsLogin };
      setPanel(i, { image: data.image });
      return { ok: true };
    },
    [draft.panels, draft.styleKey, draft.cast, setPanel]
  );

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
    <section aria-label="Edit your manga">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-ink2 hover:text-ink"
        >
          ← Start over
        </button>
        <span className="text-[12px] font-bold text-ink3">
          {drawnCount}/{draft.panels.length} panels drawn
        </span>
      </div>

      <div className="mt-4">
        <p className="av-eyebrow">
          Editing · {studioStyleLabel(draft.styleKey)}
          {draft.genre ? ` · ${draft.genre}` : ""}
        </p>
        <input
          value={draft.title.en}
          onChange={(e) => onMutate((d) => ({ ...d, title: { ...d.title, en: e.target.value } }))}
          className="mt-2 w-full border-b-2 border-line bg-transparent pb-1 font-jpround text-[clamp(24px,4vw,36px)] font-black leading-tight outline-none focus:border-ink"
          aria-label="Manga title"
          placeholder="Title"
        />
        <input
          value={draft.title.sub}
          onChange={(e) => onMutate((d) => ({ ...d, title: { ...d.title, sub: e.target.value } }))}
          className="mt-1.5 w-full border-b border-line bg-transparent pb-0.5 font-jpround text-[15px] font-bold text-ink2 outline-none focus:border-ink"
          aria-label="Subtitle"
          placeholder="Subtitle (optional)"
        />
        <input
          value={draft.logline}
          onChange={(e) => onMutate((d) => ({ ...d, logline: e.target.value }))}
          className="mt-2 w-full border-b border-line bg-transparent pb-0.5 text-[13.5px] italic text-ink2 outline-none focus:border-ink"
          aria-label="Logline"
          placeholder="One-line logline"
        />
      </div>

      {draft.cast.length > 0 && (
        <div className="av-card mt-5 p-4">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">Cast</h3>
          <div className="mt-2 space-y-2">
            {draft.cast.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={c.name}
                  onChange={(e) => setCastMember(i, { name: e.target.value })}
                  placeholder="Name"
                  className="w-32 border-2 border-line bg-field px-2.5 py-1.5 text-[13px] font-bold outline-none focus:border-ink"
                />
                <input
                  value={c.look}
                  onChange={(e) => setCastMember(i, { look: e.target.value })}
                  placeholder="Look (kept consistent across panels)"
                  className="min-w-[14rem] flex-1 border-2 border-line bg-field px-2.5 py-1.5 text-[12.5px] outline-none focus:border-ink"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink3">
            Editing a look changes how that character is drawn on the next redraw.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {draft.panels.map((panel, i) => (
          <PanelCard
            key={i}
            index={i}
            total={draft.panels.length}
            panel={panel}
            onSceneChange={(scene) => setPanel(i, { scene })}
            onLinesChange={(lines) => setPanel(i, { lines })}
            onMove={(dir) => movePanel(i, dir)}
            onDelete={() => deletePanel(i)}
            onDraw={(sketch) => drawPanel(i, sketch)}
          />
        ))}
      </div>

      {draft.panels.length < MAX_STUDIO_PANELS && (
        <button
          type="button"
          onClick={addPanel}
          className="av-btn av-btn-ghost mt-5 w-full justify-center border-dashed"
        >
          + Add panel
        </button>
      )}

      <div className="av-card mt-8 p-5 sm:p-6">
        {missing > 0 && (
          <p className="text-[13px] font-bold text-ink2">
            {missing} panel{missing > 1 ? "s" : ""} still need art. Draw them, or publish later.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="av-btn av-btn-primary">
            {saving ? "Saving…" : auth === "in" ? "Save my manga" : "Log in to save & publish"}
          </button>
          {auth !== "in" && (
            <span className="text-[12.5px] text-ink3">Your manga is kept in this browser until you sign in.</span>
          )}
        </div>
        {error && (
          <div className="mt-3">
            <p className="text-[13px] font-bold text-danger">{errorMessage(error)}</p>
            {needsLogin && (
              <a href={signInHref()} className="av-btn av-btn-primary mt-2 inline-flex">
                Sign in — it&apos;s free
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function PanelCard({
  index,
  total,
  panel,
  onSceneChange,
  onLinesChange,
  onMove,
  onDelete,
  onDraw,
}: {
  index: number;
  total: number;
  panel: DraftPanel;
  onSceneChange: (scene: string) => void;
  onLinesChange: (lines: MangaLine[]) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onDraw: (sketch?: string) => Promise<{ ok: boolean; error?: string; needsLogin?: boolean }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [sketching, setSketching] = useState(false);
  const sketchRef = useRef<SketchHandle | null>(null);

  const run = async (sketch?: string) => {
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    const r = await onDraw(sketch);
    if (!r.ok) {
      setError(r.error ?? "failed");
      if (r.needsLogin) setNeedsLogin(true);
    } else {
      setSketching(false);
    }
    setBusy(false);
  };

  const beautify = () => {
    const dataUrl = sketchRef.current?.toDataUrl();
    if (!dataUrl) {
      setError("empty_panel");
      return;
    }
    void run(dataUrl);
  };

  const setLine = (j: number, patch: Partial<MangaLine>) => onLinesChange(updateLine(panel.lines, j, patch));
  const addLine = () =>
    panel.lines.length < MAX_LINES_PER_PANEL && onLinesChange([...panel.lines, emptyLine()]);
  const removeLine = (j: number) => onLinesChange(panel.lines.filter((_, k) => k !== j));

  return (
    <div className="av-card overflow-hidden p-0">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,240px)_1fr]">
        <div className="border-b-2 border-line sm:border-b-0 sm:border-r-2">
          {panel.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={panel.image} alt={`Panel ${index + 1}`} className="block aspect-square w-full object-cover" />
          ) : (
            <div className="grid aspect-square w-full place-items-center bg-panel px-4 text-center text-[12px] font-bold text-ink3">
              {busy ? "Drawing…" : "No art yet"}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-ink3">Panel {index + 1}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => onMove(-1)}
                className="grid h-6 w-6 place-items-center rounded border-2 border-line text-[12px] text-ink2 disabled:opacity-30 hover:text-ink"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={index === total - 1}
                onClick={() => onMove(1)}
                className="grid h-6 w-6 place-items-center rounded border-2 border-line text-[12px] text-ink2 disabled:opacity-30 hover:text-ink"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Delete panel"
                disabled={total <= 1}
                onClick={onDelete}
                className="grid h-6 w-6 place-items-center rounded border-2 border-line text-[12px] text-ink3 disabled:opacity-30 hover:text-danger"
              >
                ✕
              </button>
            </div>
          </div>

          <label className="mt-2 block text-[11px] font-bold text-ink3">
            Scene (what to draw)
            <textarea
              value={panel.scene}
              onChange={(e) => onSceneChange(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-y border-2 border-line bg-field px-2.5 py-1.5 text-[12.5px] leading-snug text-ink outline-none focus:border-ink"
            />
          </label>

          <div className="mt-3 space-y-2.5">
            {panel.lines.map((line, j) => {
              const meta = LINE_META[line.kind];
              return (
                <div key={j} className="rounded-md border-2 border-line p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {LINE_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={line.kind === k}
                        onClick={() => setLine(j, { kind: k, speaker: LINE_META[k].hasSpeaker ? line.speaker : "" })}
                        className={
                          "rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold transition " +
                          (line.kind === k ? "border-ink bg-ink text-bg" : "border-line text-ink3 hover:text-ink")
                        }
                      >
                        {LINE_META[k].label}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => removeLine(j)}
                      className="ml-auto text-[12px] text-ink3 hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  {meta.hasSpeaker && (
                    <input
                      value={line.speaker}
                      onChange={(e) => setLine(j, { speaker: e.target.value })}
                      placeholder="Speaker"
                      className="mb-1.5 w-32 border-b border-line bg-transparent pb-0.5 text-[11px] font-black text-accent outline-none focus:border-ink"
                    />
                  )}
                  <input
                    value={line.text}
                    onChange={(e) => setLine(j, { text: e.target.value })}
                    placeholder={line.kind === "sfx" ? "BOOM" : line.kind === "narration" ? "Caption…" : "Line…"}
                    className="w-full border-b border-line bg-transparent pb-0.5 text-[13.5px] outline-none focus:border-ink"
                  />
                </div>
              );
            })}
            {panel.lines.length < MAX_LINES_PER_PANEL && (
              <button
                type="button"
                onClick={addLine}
                className="text-[12px] font-extrabold text-ink3 hover:text-ink"
              >
                + Add line
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void run()} disabled={busy} className="av-btn av-btn-ghost">
              {busy ? "…" : panel.image ? "↻ Redraw" : "🎨 Draw art"}
            </button>
            <button
              type="button"
              onClick={() => setSketching((v) => !v)}
              disabled={busy}
              aria-pressed={sketching}
              className="av-btn av-btn-quiet"
            >
              {sketching ? "Close sketch" : "✏️ Sketch it"}
            </button>
          </div>

          {sketching && (
            <div className="mt-3 rounded-lg border-2 border-line p-3">
              <p className="mb-2 text-[12px] font-bold text-ink2">
                Rough it out — stick figures are fine. The AI redraws it in your style.
              </p>
              <SketchCanvas ref={sketchRef} />
              <button type="button" onClick={beautify} disabled={busy} className="av-btn av-btn-primary mt-3">
                {busy ? "Beautifying…" : "✨ Beautify my sketch"}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-2">
              <p className="text-[12.5px] font-bold text-danger">{errorMessage(error)}</p>
              {needsLogin && (
                <a href={signInHref()} className="text-[12.5px] font-extrabold text-accent underline">
                  Sign in to keep drawing →
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
