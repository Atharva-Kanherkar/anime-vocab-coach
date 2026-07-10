"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeaturedEndingManga } from "@/lib/ending-hooks";
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
  const [selected, setSelected] = useState<string | null>(null);
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
    <div className="end-min end-min--picker">
      <Link href="/end" className="end-min__back">
        ← All series
      </Link>

      <header className="end-min__header end-min__header--tight">
        <p className="end-min__kicker">Fan ending · {manga.tag}</p>
        <h1 className="end-min__h1">{manga.title}</h1>
        <p className="end-min__jp">{manga.subtitle}</p>
        <p className="end-min__sub">{manga.synopsis}</p>
        <p className="end-min__cliff">{manga.cliffhanger}</p>
      </header>

      <ul className="end-min__choices">
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
                className={"end-min__choice" + (on ? " is-on" : "")}
                aria-pressed={on}
              >
                <span className="end-min__choice-title">{e.title}</span>
                <span className="end-min__choice-blurb">{e.blurb}</span>
                <span className="end-min__choice-tone">{e.tone}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <label className="end-min__note">
        <span>Optional twist</span>
        <textarea
          value={customNote}
          onChange={(ev) => setCustomNote(ev.target.value.slice(0, 280))}
          rows={2}
          placeholder="One sentence — your personal beat"
        />
      </label>

      {error && (
        <p className="end-min__err">
          {error}{" "}
          {error.includes("Sign in") && (
            <a href={`/sign-in?redirect_url=/end/${manga.id}`}>Sign in →</a>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !selected}
        onClick={() => void generate()}
        className="end-min__cta"
      >
        {busy ? "Writing your fan ending…" : "Generate fan ending →"}
      </button>

      <p className="end-min__legal">
        Unofficial fan art / fan ending. Not affiliated with the original publishers.
      </p>
    </div>
  );
}
