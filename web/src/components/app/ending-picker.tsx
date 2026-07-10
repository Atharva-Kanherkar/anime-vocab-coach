"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeaturedEndingManga, EndingChoiceId } from "@/lib/ending-hooks";
import { newDraftFromScript, saveDraft } from "@/lib/studio-draft";
import type { StyleKey } from "@/lib/cards";
import type { StudioCastMember, StudioPanelScript } from "@/lib/studio";
import { trackMeta, trackMetaCustom } from "@/lib/meta-pixel";

type ScriptResponse = {
  title: { en: string; sub: string };
  logline: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
  base: {
    genre: string;
    tone: string;
    setting: string;
    language: string;
    styleKey: StyleKey;
  };
  error?: string;
  needsLogin?: boolean;
};

const ERRORS: Record<string, string> = {
  anon_draft_limit: "You've used today's free tries. Sign in (free) to keep creating endings.",
  ai_not_configured: "Studio isn't ready on this deploy yet — try again soon.",
  manga_not_found: "That manga isn't available.",
  ending_not_found: "Pick one of the three endings.",
};

export function EndingPicker({ manga }: { manga: FeaturedEndingManga }) {
  const router = useRouter();
  const [selected, setSelected] = useState<EndingChoiceId | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!selected) {
      setError("Pick an ending first.");
      return;
    }
    setBusy(true);
    setError(null);
    trackMetaCustom("EndingChosen", { manga_id: manga.id, ending_id: selected });

    try {
      const res = await fetch("/api/studio/ending", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          endingId: selected,
          customNote: customNote.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ScriptResponse;
      if (!res.ok) {
        setError(ERRORS[data.error ?? ""] ?? data.error ?? "Could not draft your ending. Try again.");
        if (data.needsLogin) {
          // Keep them on-page with a clear next step.
        }
        return;
      }

      const draft = newDraftFromScript({
        ...data.base,
        title: data.title,
        logline: data.logline,
        cast: data.cast,
        panels: data.panels,
      });
      saveDraft(draft);
      trackMeta("StartTrial", { content_name: "ending_epilogue", manga_id: manga.id });
      trackMetaCustom("StudioOpen", { source: "ending", manga_id: manga.id });
      router.push("/studio?from=ending");
    } catch {
      setError("Network hiccup — nothing was used up. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <p className="av-eyebrow">Choose your ending · 結末</p>
      <h1 className="mt-2 font-jpround text-[clamp(26px,5vw,40px)] font-black leading-tight">
        {manga.title}
      </h1>
      <p className="mt-2 text-[14px] font-bold text-ink3">{manga.subtitle}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink2">{manga.synopsis}</p>
      <p className="mt-3 rounded-xl border-2 border-accent/40 bg-panel px-4 py-3 text-[14.5px] font-bold text-ink">
        {manga.cliffhanger}
      </p>

      <ul className="mt-8 grid list-none gap-3 pl-0">
        {manga.endings.map((e) => {
          const on = selected === e.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(e.id);
                  setError(null);
                }}
                className={
                  "w-full rounded-2xl border-2 px-4 py-4 text-left transition " +
                  (on
                    ? "border-accent bg-accent/10 shadow-[0_0_0_1px_var(--accent)]"
                    : "border-line bg-panel hover:border-ink3")
                }
              >
                <span className="block font-jpround text-[17px] font-black">{e.title}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-ink2">{e.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <label className="mt-6 block">
        <span className="text-[12px] font-bold uppercase tracking-wide text-ink3">
          Optional — add your twist (one sentence)
        </span>
        <textarea
          value={customNote}
          onChange={(ev) => setCustomNote(ev.target.value.slice(0, 280))}
          rows={2}
          placeholder="e.g. Mu learns to cook soup for the keepers"
          className="mt-1.5 w-full rounded-xl border-2 border-line bg-panel px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
        />
      </label>

      {error && (
        <p className="mt-4 rounded-lg border-2 border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13.5px] font-bold text-ink">
          {error}{" "}
          {error.includes("Sign in") && (
            <a className="underline text-accent" href="/sign-in?redirect_url=/end/lantern-of-words">
              Sign in →
            </a>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void generate()}
        className="av-btn av-btn-primary mt-6 w-full justify-center py-3.5 text-[16px] disabled:opacity-50"
      >
        {busy ? "Writing your epilogue…" : "Generate my ending →"}
      </button>
      <p className="mt-3 text-center text-[12.5px] text-ink3">
        Free · no account needed for your first try. Then edit panels in Studio and share.
      </p>
    </div>
  );
}
