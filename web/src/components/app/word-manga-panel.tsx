"use client";

// Manga Studio — the no-extension creation loop. Pick up to 3 words you're
// learning (synced vocab, or starter words on a fresh account), pick an art
// style, and the AI writes + draws a 4-panel manga that USES those words.
// Reading it back (JA/romaji/EN) and passing the word check earn XP on the
// same ladder that unlocks saga chapters and cards.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudSnapshot } from "@/lib/cloud-snapshot-store";
import {
  MAX_STUDIO_WORDS,
  STARTER_WORDS,
  STUDIO_STYLES,
  studioStyleLabel,
  type StudioCreationMeta,
  type StudioIndexEntry,
  type StudioWord,
} from "@/lib/word-manga";
import type { StyleKey } from "@/lib/cards";
import {
  hasPassedWordCheck,
  markWordCheckPassed,
  setCreationCount,
  useStudioProgress,
  XP_PER_CREATION,
  XP_PER_WORD_CHECK,
} from "@/lib/studio-xp";
import { StudioReaderView } from "@/components/app/word-manga-reader";

const GENERATING_LINES = [
  "Drafting your script…",
  "Casting two characters…",
  "Sketching four panels…",
  "Inking the page…",
  "Laying screentones…",
  "Almost there — printing…",
];

const ERROR_COPY: Record<string, string> = {
  studio_quota_exhausted: "You've used all your free creations this month — more unlock next month.",
  ai_not_configured: "The studio isn't configured on this deployment yet. Try again later.",
  no_words: "Pick at least one word first.",
  unauthorized: "Sign in (free) to create your manga.",
};

function errorMessage(code: string): string {
  return ERROR_COPY[code] ?? "Generation failed — nothing was used up. Try again.";
}

interface Usage {
  used: number;
  limit: number;
}

export function WordMangaPanel() {
  const snapshot = useCloudSnapshot();
  const [entries, setEntries] = useState<StudioIndexEntry[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [open, setOpen] = useState<StudioCreationMeta | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/word-manga");
      if (!res.ok) return;
      const data = (await res.json()) as { creations: StudioIndexEntry[]; usage: Usage };
      setEntries(data.creations);
      setUsage(data.usage);
      setCreationCount(data.creations.length);
    } catch {
      // Signed-out / offline: the composer still renders; generate will surface it.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void refreshList(), 0);
    return () => clearTimeout(t);
  }, [refreshList]);

  const openCreation = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/word-manga/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as { creation: StudioCreationMeta };
      setOpen(data.creation);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoadingId(null);
    }
  }, []);

  // Words the learner can build from: synced vocabulary first, starters for
  // brand-new accounts so the studio works before any watching at all.
  const availableWords = useMemo<StudioWord[]>(() => {
    const fromSync = snapshot.words
      .filter((w) => w.base && w.gloss)
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""))
      .slice(0, 30)
      .map((w) => ({ base: w.base, reading: w.reading, gloss: w.gloss }));
    return fromSync.length > 0 ? fromSync : STARTER_WORDS;
  }, [snapshot.words]);

  if (open) {
    return (
      <OpenCreation
        meta={open}
        onBack={() => setOpen(null)}
        onChanged={(next) => {
          setOpen(next);
          void refreshList();
        }}
        onDeleted={() => {
          setOpen(null);
          void refreshList();
        }}
      />
    );
  }

  return (
    <section aria-label="Manga Studio">
      <header>
        <p className="av-eyebrow">Manga Studio · 創作</p>
        <h1 className="mt-2 font-jpround text-[clamp(26px,4vw,40px)] font-black leading-tight">
          Write your own manga
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14.5px] leading-relaxed text-ink2">
          Pick up to {MAX_STUDIO_WORDS} words you&apos;re learning. The studio writes a 4-panel
          scene that uses them in real Japanese dialogue, draws the page in an anime style you
          choose, and lets you read it in English, 日本語, or romaji. Every creation earns{" "}
          <b className="text-accent">+{XP_PER_CREATION} XP</b> toward saga chapters and cards — no
          extension, no Netflix needed.
        </p>
      </header>

      <Composer
        availableWords={availableWords}
        usingStarters={snapshot.words.length === 0}
        usage={usage}
        onCreated={(meta) => {
          setOpen(meta);
          void refreshList();
        }}
      />

      {entries.length > 0 && (
        <section className="mt-12">
          <h2 className="av-eyebrow">Your mangas · 本棚</h2>
          <ul className="mt-3 grid list-none grid-cols-1 gap-2.5 pl-0 sm:grid-cols-2">
            {entries.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={loadingId === e.id}
                  onClick={() => void openCreation(e.id)}
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

// ── Composer ─────────────────────────────────────────────────────────────

function Composer({
  availableWords,
  usingStarters,
  usage,
  onCreated,
}: {
  availableWords: StudioWord[];
  usingStarters: boolean;
  usage: Usage | null;
  onCreated: (meta: StudioCreationMeta) => void;
}) {
  const [selected, setSelected] = useState<StudioWord[]>([]);
  const [styleKey, setStyleKey] = useState<StyleKey>(STUDIO_STYLES[0]);
  const [premise, setPremise] = useState("");
  const [customWord, setCustomWord] = useState("");
  const [customGloss, setCustomGloss] = useState("");
  const [customWords, setCustomWords] = useState<StudioWord[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

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

  // Rotate the status line while generating. statusIdx is reset in generate()
  // (not here) so the effect body never calls setState synchronously.
  useEffect(() => {
    if (!busy) return;
    timerRef.current = window.setInterval(
      () => setStatusIdx((i) => Math.min(i + 1, GENERATING_LINES.length - 1)),
      9000
    );
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [busy]);

  const generate = async () => {
    if (selected.length === 0) {
      setError("no_words");
      return;
    }
    setStatusIdx(0);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/word-manga", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ words: selected, styleKey, premise }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        creation?: StudioCreationMeta;
        error?: string;
      };
      if (!res.ok || !data.creation) {
        setError(data.error ?? "failed");
        return;
      }
      setSelected([]);
      setPremise("");
      onCreated(data.creation);
    } catch {
      setError("failed");
    } finally {
      setBusy(false);
    }
  };

  const quotaLeft = usage ? Math.max(0, usage.limit - usage.used) : null;
  const unlimited = usage ? usage.limit > 100000 : false;

  return (
    <div className="av-card mt-8 p-5 sm:p-6">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
        1 · Words to practice{" "}
        {usingStarters && <span className="normal-case tracking-normal">(starter set — your captured words appear here once you sync)</span>}
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

      <h2 className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.15em] text-ink3">
        2 · Art style
      </h2>
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
        3 · Scene idea <span className="normal-case tracking-normal">(optional)</span>
      </h2>
      <input
        value={premise}
        onChange={(e) => setPremise(e.target.value)}
        maxLength={200}
        placeholder="Two rivals stuck at a train station in the rain…"
        className="mt-3 w-full border-2 border-line bg-field px-3 py-2.5 text-[13.5px] outline-none focus:border-ink"
      />

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || selected.length === 0 || quotaLeft === 0}
          className="av-btn av-btn-primary"
        >
          {busy ? GENERATING_LINES[statusIdx] : `Draw my manga · +${XP_PER_CREATION} XP`}
        </button>
        {usage && !unlimited && (
          <span className="text-[12.5px] font-bold text-ink3">
            {quotaLeft} of {usage.limit} free creations left this month
          </span>
        )}
        {busy && (
          <span className="text-[12.5px] text-ink3">takes about a minute — worth it</span>
        )}
      </div>
      {error && <p className="mt-3 text-[13px] font-bold text-danger">{errorMessage(error)}</p>}
    </div>
  );
}

// ── Open creation: reader + share + word check ───────────────────────────

function OpenCreation({
  meta,
  onBack,
  onChanged,
  onDeleted,
}: {
  meta: StudioCreationMeta;
  onBack: () => void;
  onChanged: (meta: StudioCreationMeta) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const toggleShare = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/word-manga/${meta.id}`, {
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
      await navigator.clipboard.writeText(`${window.location.origin}/wm/${meta.id}`);
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
      const res = await fetch(`/api/word-manga/${meta.id}`, { method: "DELETE" });
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
          imageUrl={`/api/word-manga/${meta.id}/image`}
          footer={
            <>
              <WordCheck meta={meta} />
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <button type="button" onClick={() => void toggleShare()} disabled={busy} className="av-btn av-btn-ghost">
                  {meta.isPublic ? "Make private" : "Share publicly"}
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
                  Anyone with the link can read it: /wm/{meta.id}
                </p>
              )}
            </>
          }
        />
      </div>
    </section>
  );
}

// ── Word check: prove the words stuck, earn XP ───────────────────────────

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

  // Options per word: its gloss + decoys from the other words and starters.
  const options = useMemo(() => {
    const decoyPool = [
      ...meta.words.map((w) => w.gloss),
      ...STARTER_WORDS.map((w) => w.gloss),
    ];
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
