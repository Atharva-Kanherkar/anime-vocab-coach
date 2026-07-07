"use client";

// Manga Studio — the full AI-assisted editor. Flow:
//   1. compose  — pick target words, an art style, and write the story beats
//   2. edit     — AI drafts the panels; per panel you edit the dialogue, redraw
//                 the art, or hand-draw a sketch the AI beautifies into style
//   3. saved    — the finished manga: read it, pass the word check for XP, share
// It runs on the public /studio page AND inside the signed-in /app. Logged-out
// visitors get one free manga held in this browser; saving/publishing needs a
// (free) sign-in, after which the draft is restored and saved to the account.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import {
  MAX_STUDIO_WORDS,
  MAX_PREMISE_LEN,
  STARTER_WORDS,
  STUDIO_STYLES,
  studioStyleLabel,
  type StudioCastMember,
  type StudioCreationMeta,
  type StudioIndexEntry,
  type StudioPanelScript,
  type StudioText,
  type StudioWord,
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
import {
  hasPassedWordCheck,
  markWordCheckPassed,
  setCreationCount,
  useStudioProgress,
  XP_PER_CREATION,
  XP_PER_WORD_CHECK,
} from "@/lib/studio-xp";
import { SketchCanvas, type SketchHandle } from "@/components/app/sketch-canvas";
import { StudioReaderView } from "@/components/app/studio-reader";

type Auth = "unknown" | "in" | "out";

const ERROR_COPY: Record<string, string> = {
  ai_not_configured: "The studio isn't configured on this deployment yet. Try again later.",
  no_words: "Pick at least one word first.",
  anon_draft_limit: "You've used your free tries for today. Sign in (free) to keep creating.",
  anon_art_limit: "You've used your free art for today. Sign in (free) to draw more.",
  art_quota_exhausted: "You've used all your art for this month — more unlocks next month.",
  studio_quota_exhausted: "You've saved all your free mangas this month — more unlock next month.",
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

export function StudioEditor() {
  const snapshot = useCloudSnapshot();
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
      setCreationCount(data.creations.length);
    } catch {
      // Offline: leave auth unknown; the composer still works optimistically.
    }
  }, []);

  // Defer the initial fetch + draft restore off the render (localStorage is
  // client-only; running in a timeout keeps setState out of the effect body).
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

  const availableWords = useMemo<StudioWord[]>(() => {
    const fromSync = snapshot.words
      .filter((w) => w.base && w.gloss)
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
      .slice(0, 30)
      .map((w) => ({ base: w.base, reading: w.reading, gloss: w.gloss }));
    return fromSync.length > 0 ? fromSync : STARTER_WORDS;
  }, [snapshot.words]);

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

  // ── Saved manga view ──
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

  // ── Editing an in-progress draft ──
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

  // ── Compose a new manga ──
  return (
    <section aria-label="Manga Studio">
      <header>
        <p className="av-eyebrow">Manga Studio · 創作</p>
        <h1 className="mt-2 font-jpround text-[clamp(26px,4vw,40px)] font-black leading-tight">
          Make your own manga
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink2">
          Pick up to {MAX_STUDIO_WORDS} words you&apos;re learning and tell the studio your story.
          The AI drafts the panels in real Japanese; you edit any line, redraw any panel, or{" "}
          <b className="text-accent">sketch it yourself and let the AI beautify it</b>. Read it in
          English, 日本語, or romaji, pass the word check, and earn{" "}
          <b className="text-accent">+{XP_PER_CREATION} XP</b>.
        </p>
        {auth === "out" && (
          <p className="mt-3 rounded-lg border-2 border-line bg-panel px-4 py-2.5 text-[13px] font-bold text-ink2">
            Try it free — no account needed. Sign in (also free) to save, publish, and make more.
          </p>
        )}
      </header>

      <Composer
        availableWords={availableWords}
        usingStarters={snapshot.words.length === 0}
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
                    <span className="block truncate font-jpround text-[15px] font-black">
                      {e.title.en}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink3">
                      {studioStyleLabel(e.styleKey)} · {e.words.join("、")}
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

// ── Step 1: Composer ──────────────────────────────────────────────────────

function Composer({
  availableWords,
  usingStarters,
  auth,
  onDrafted,
}: {
  availableWords: StudioWord[];
  usingStarters: boolean;
  auth: Auth;
  onDrafted: (
    script: { title: { en: string; ja: string; romaji: string }; cast: StudioCastMember[]; panels: StudioPanelScript[] },
    base: { words: StudioWord[]; styleKey: StyleKey; premise: string }
  ) => void;
}) {
  const [selected, setSelected] = useState<StudioWord[]>([]);
  const [styleKey, setStyleKey] = useState<StyleKey>(STUDIO_STYLES[0]);
  const [premise, setPremise] = useState("");
  const [customWord, setCustomWord] = useState("");
  const [customGloss, setCustomGloss] = useState("");
  const [customWords, setCustomWords] = useState<StudioWord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const words = useMemo(() => [...customWords, ...availableWords], [customWords, availableWords]);
  const isSelected = (w: StudioWord) => selected.some((s) => s.base === w.base);

  const toggle = (w: StudioWord) => {
    setError(null);
    setSelected((cur) =>
      cur.some((s) => s.base === w.base)
        ? cur.filter((s) => s.base !== w.base)
        : cur.length >= MAX_STUDIO_WORDS
          ? cur
          : [...cur, w]
    );
  };

  const addCustom = () => {
    const base = customWord.trim();
    const gloss = customGloss.trim();
    if (!base || !gloss) return;
    const w: StudioWord = { base, reading: "", gloss };
    setCustomWords((cur) => [w, ...cur.filter((c) => c.base !== base)]);
    if (selected.length < MAX_STUDIO_WORDS && !isSelected(w)) setSelected((cur) => [...cur, w]);
    setCustomWord("");
    setCustomGloss("");
  };

  const draft = async () => {
    if (selected.length === 0) {
      setError("no_words");
      return;
    }
    setBusy(true);
    setError(null);
    setNeedsLogin(false);
    try {
      const res = await fetch("/api/studio/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ words: selected, styleKey, premise }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        title?: { en: string; ja: string; romaji: string };
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
        { title: data.title ?? { en: "Untitled", ja: "", romaji: "" }, cast: data.cast ?? [], panels: data.panels },
        { words: selected, styleKey, premise }
      );
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="av-card mt-8 p-5 sm:p-6">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
        1 · Words to practice{" "}
        {usingStarters && (
          <span className="normal-case tracking-normal">
            (starter set — your captured words appear here once you sync)
          </span>
        )}
      </h2>
      <ul className="mt-3 flex list-none flex-wrap gap-2 pl-0">
        {words.map((w) => {
          const on = isSelected(w);
          return (
            <li key={w.base}>
              <button
                type="button"
                onClick={() => toggle(w)}
                aria-pressed={on}
                className={
                  "rounded-full border-2 px-3 py-1.5 text-[12.5px] font-bold transition " +
                  (on ? "border-accent bg-accent text-[#fffdf6]" : "border-line text-ink2 hover:text-ink")
                }
              >
                <span className="font-jp font-black">{w.base}</span>
                <span className="ml-1.5 opacity-80">{w.gloss}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={customWord}
          onChange={(e) => setCustomWord(e.target.value)}
          placeholder="Add a word (e.g. 約束)"
          className="w-40 border-2 border-line bg-field px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
        <input
          value={customGloss}
          onChange={(e) => setCustomGloss(e.target.value)}
          placeholder="its meaning (promise)"
          className="w-44 border-2 border-line bg-field px-3 py-2 text-[13px] outline-none focus:border-ink"
        />
        <button type="button" onClick={addCustom} className="av-btn av-btn-ghost">
          Add
        </button>
      </div>

      <h2 className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">2 · Art style</h2>
      <ul className="mt-3 flex list-none flex-wrap gap-2 pl-0">
        {STUDIO_STYLES.map((key) => {
          const on = styleKey === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => setStyleKey(key)}
                aria-pressed={on}
                className={
                  "rounded-full border-2 px-4 py-1.5 text-[12.5px] font-extrabold transition " +
                  (on ? "border-ink bg-ink text-bg" : "border-line text-ink2 hover:text-ink")
                }
              >
                {studioStyleLabel(key)}
              </button>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
        3 · Your story <span className="normal-case tracking-normal">(the AI follows your beats)</span>
      </h2>
      <textarea
        value={premise}
        onChange={(e) => setPremise(e.target.value)}
        maxLength={MAX_PREMISE_LEN}
        rows={3}
        placeholder="Two rivals are stuck at a train station in the rain. One finally admits they were wrong…"
        className="mt-3 w-full resize-y border-2 border-line bg-field px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-ink"
      />

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void draft()}
          disabled={busy || selected.length === 0}
          className="av-btn av-btn-primary"
        >
          {busy ? "Drafting your story…" : "✍️ Draft with AI"}
        </button>
        {busy && <span className="text-[12.5px] text-ink3">writing your panels…</span>}
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

// ── Step 2: Edit the drafted manga ─────────────────────────────────────────

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

  const drawPanel = useCallback(
    async (i: number, sketch?: string): Promise<{ ok: boolean; error?: string; needsLogin?: boolean }> => {
      const panel = draft.panels[i];
      const res = await fetch("/api/studio/panel-art", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ styleKey: draft.styleKey, art: panel.art, cast: draft.cast, sketch }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        image?: string;
        error?: string;
        needsLogin?: boolean;
      };
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
          words: draft.words,
          styleKey: draft.styleKey,
          premise: draft.premise,
          cast: draft.cast,
          panels: draft.panels.map((p) => ({ art: p.art, texts: p.texts })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { creation?: StudioCreationMeta; error?: string };
      if (!res.ok || !data.creation) {
        setError(data.error ?? "failed");
        return;
      }
      const id = data.creation.id;
      // Upload the panel art we already generated (one request each).
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
        <p className="av-eyebrow">Editing · {studioStyleLabel(draft.styleKey)}</p>
        <input
          value={draft.title.en}
          onChange={(e) => onMutate((d) => ({ ...d, title: { ...d.title, en: e.target.value } }))}
          className="mt-2 w-full border-b-2 border-line bg-transparent pb-1 font-jpround text-[clamp(22px,3.5vw,32px)] font-black leading-tight outline-none focus:border-ink"
          aria-label="Manga title"
        />
        {draft.cast.length > 0 && (
          <p className="mt-2 text-[12.5px] text-ink3">
            Cast:{" "}
            {draft.cast.map((c, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <b className="text-ink2">{c.name}</b>
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {draft.panels.map((panel, i) => (
          <PanelCard
            key={i}
            index={i}
            panel={panel}
            words={draft.words.map((w) => w.base)}
            onArtChange={(art) => setPanel(i, { art })}
            onLineChange={(j, patch) => setPanel(i, { texts: updateLine(panel.texts, j, patch) })}
            onDraw={(sketch) => drawPanel(i, sketch)}
          />
        ))}
      </div>

      <div className="av-card mt-8 p-5 sm:p-6">
        {missing > 0 && (
          <p className="text-[13px] font-bold text-ink2">
            {missing} panel{missing > 1 ? "s" : ""} still need art. Draw them, or publish later.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void save()} disabled={saving} className="av-btn av-btn-primary">
            {saving
              ? "Saving…"
              : auth === "in"
                ? `Save my manga · +${XP_PER_CREATION} XP`
                : "Log in to save & publish"}
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
  panel,
  words,
  onArtChange,
  onLineChange,
  onDraw,
}: {
  index: number;
  panel: DraftPanel;
  words: string[];
  onArtChange: (art: string) => void;
  onLineChange: (j: number, patch: Partial<StudioText>) => void;
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

  return (
    <div className="av-card overflow-hidden p-0">
      <div className="grid gap-0 sm:grid-cols-[minmax(0,240px)_1fr]">
        {/* Art */}
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

        {/* Text + controls */}
        <div className="p-4 sm:p-5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-ink3">Panel {index + 1}</p>

          <label className="mt-2 block text-[11px] font-bold text-ink3">
            Scene (what to draw)
            <textarea
              value={panel.art}
              onChange={(e) => onArtChange(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-y border-2 border-line bg-field px-2.5 py-1.5 text-[12.5px] leading-snug text-ink outline-none focus:border-ink"
            />
          </label>

          <div className="mt-3 space-y-2.5">
            {panel.texts.map((t, j) => (
              <div key={j} className="rounded-md border-2 border-line p-2.5">
                <input
                  value={t.speaker}
                  onChange={(e) => onLineChange(j, { speaker: e.target.value })}
                  placeholder="Speaker"
                  className="mb-1.5 w-28 border-b border-line bg-transparent pb-0.5 text-[11px] font-black text-accent outline-none focus:border-ink"
                />
                <input
                  value={t.ja}
                  onChange={(e) => onLineChange(j, { ja: e.target.value })}
                  placeholder="日本語"
                  lang="ja"
                  className="w-full border-b border-line bg-transparent pb-0.5 font-jp text-[14px] outline-none focus:border-ink"
                />
                <input
                  value={t.romaji}
                  onChange={(e) => onLineChange(j, { romaji: e.target.value })}
                  placeholder="romaji"
                  className="mt-1 w-full border-b border-line bg-transparent pb-0.5 text-[12px] text-ink2 outline-none focus:border-ink"
                />
                <input
                  value={t.en}
                  onChange={(e) => onLineChange(j, { en: e.target.value })}
                  placeholder="English"
                  className="mt-1 w-full border-b border-line bg-transparent pb-0.5 text-[12.5px] text-ink2 outline-none focus:border-ink"
                />
              </div>
            ))}
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
              <button
                type="button"
                onClick={beautify}
                disabled={busy}
                className="av-btn av-btn-primary mt-3"
              >
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
          {words.length > 0 && (
            <p className="mt-2 text-[11px] text-ink3">
              Keep your words in the dialogue: <span className="font-jp text-accent">{words.join("、")}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Saved manga (read, word check, share) ──────────────────────────

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
          panelImageUrls={meta.panels.map((_, i) => `/api/studio/${meta.id}/panel/${i}`)}
          footer={
            <>
              <WordCheck meta={meta} />
              {canManage && (
                <>
                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
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
                    <p className="mt-2 break-all text-[12px] text-ink3">
                      Public — in the gallery and at /m/{meta.id}
                    </p>
                  )}
                </>
              )}
            </>
          }
        />
      </div>
    </section>
  );
}

// ── Word check ──────────────────────────────────────────────────────────

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function WordCheck({ meta }: { meta: StudioCreationMeta }) {
  const progress = useStudioProgress();
  const passed = hasPassedWordCheck(progress, meta.id);
  const [picks, setPicks] = useState<Record<string, string>>({});

  const options = useMemo(() => {
    const decoyPool = [...meta.words.map((w) => w.gloss), ...STARTER_WORDS.map((w) => w.gloss)];
    const map: Record<string, string[]> = {};
    for (const w of meta.words) {
      const decoys = shuffled(decoyPool.filter((g) => g !== w.gloss)).slice(0, 2);
      map[w.base] = shuffled([w.gloss, ...decoys]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one quiz layout per creation
  }, [meta.id]);

  const allCorrect = meta.words.every((w) => picks[w.base] === w.gloss);
  const allPicked = meta.words.every((w) => picks[w.base] !== undefined);

  useEffect(() => {
    if (allPicked && allCorrect && !passed) markWordCheckPassed(meta.id);
  }, [allPicked, allCorrect, passed, meta.id]);

  if (passed) {
    return (
      <p className="text-[13px] font-extrabold text-accent">
        ✓ Word check passed · +{XP_PER_WORD_CHECK} XP earned
      </p>
    );
  }

  return (
    <div>
      <h2 className="av-eyebrow">Word check · 確認 — +{XP_PER_WORD_CHECK} XP</h2>
      <div className="mt-3 space-y-4">
        {meta.words.map((w) => {
          const pick = picks[w.base];
          return (
            <div key={w.base}>
              <p className="font-jp text-[16px] font-black">
                {w.base}
                {w.reading && <span className="ml-2 text-[13px] font-bold text-ink2">{w.reading}</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {options[w.base]?.map((opt) => {
                  const chosen = pick === opt;
                  const wrong = chosen && opt !== w.gloss;
                  const right = chosen && opt === w.gloss;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPicks((cur) => ({ ...cur, [w.base]: opt }))}
                      className={
                        "rounded-full border-2 px-3 py-1.5 text-[12.5px] font-bold transition " +
                        (right
                          ? "border-ok text-ok"
                          : wrong
                            ? "border-danger text-danger"
                            : "border-line text-ink2 hover:text-ink")
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
