"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { newDraftFromScript, saveDraft } from "@/lib/studio-draft";
import type { StyleKey } from "@/lib/cards";
import type { StudioCastMember, StudioPanelScript } from "@/lib/studio";
import { trackMeta, trackMetaCustom } from "@/lib/meta-pixel";

type Option = {
  id: string;
  title: string;
  blurb: string;
  tone: string;
  premiseBeat: string;
};

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
  anon_draft_limit: "You've used today's free tries. Sign in (free) to keep creating.",
  ai_not_configured: "Studio isn't ready on this deploy yet — try again soon.",
  title_required: "Type a manga or anime title.",
  options_failed: "Couldn't invent endings — try again.",
};

/**
 * Agentic: type any famous manga → AI invents 3 fan endings → generate epilogue.
 */
export function CustomEnding() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [busy, setBusy] = useState<"options" | "gen" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function inventOptions() {
    const t = title.trim();
    if (t.length < 2) {
      setError("Type a manga or anime title.");
      return;
    }
    setBusy("options");
    setError(null);
    setOptions(null);
    setSelected(null);
    trackMetaCustom("CustomEndingTitle", { title: t.slice(0, 40) });

    try {
      const res = await fetch("/api/studio/ending/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, synopsis: synopsis.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        options?: Option[];
        error?: string;
        needsLogin?: boolean;
      };
      if (!res.ok) {
        setError(ERRORS[data.error ?? ""] ?? data.error ?? "Could not invent endings.");
        return;
      }
      setOptions(data.options ?? null);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!options || !selected) {
      setError("Pick an ending first.");
      return;
    }
    const choice = options.find((o) => o.id === selected);
    if (!choice) return;

    setBusy("gen");
    setError(null);
    trackMetaCustom("EndingChosen", { manga_id: "custom", ending_id: choice.id });

    try {
      const res = await fetch("/api/studio/ending", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "custom",
          title: title.trim(),
          synopsis: synopsis.trim() || `After the finale of ${title.trim()}.`,
          endingTitle: choice.title,
          endingBlurb: choice.blurb,
          tone: choice.tone,
          premiseBeat: choice.premiseBeat,
          customNote: customNote.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ScriptResponse;
      if (!res.ok) {
        setError(ERRORS[data.error ?? ""] ?? data.error ?? "Could not draft your ending.");
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
      trackMeta("StartTrial", { content_name: "custom_ending", manga_id: "custom" });
      trackMetaCustom("StudioOpen", { source: "custom_ending" });
      router.push("/studio?from=ending");
    } catch {
      setError("Network hiccup — nothing was used up. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="end-min end-min--picker">
      <Link href="/end" className="end-min__back">
        ← All series
      </Link>

      <header className="end-min__header end-min__header--tight">
        <p className="end-min__kicker">Fan ending · any title</p>
        <h1 className="end-min__h1">Type any manga</h1>
        <p className="end-min__sub">
          We invent three fan endings. You pick one. Get a fan-art epilogue chapter.
        </p>
      </header>

      <label className="end-min__note">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(ev) => setTitle(ev.target.value.slice(0, 80))}
          placeholder="e.g. One Piece, Jujutsu Kaisen, Your Name…"
          disabled={busy !== null}
        />
      </label>

      <label className="end-min__note">
        <span>Optional context (where the story left off)</span>
        <textarea
          value={synopsis}
          onChange={(ev) => setSynopsis(ev.target.value.slice(0, 500))}
          rows={2}
          placeholder="After the finale…"
          disabled={busy !== null}
        />
      </label>

      {!options && (
        <button
          type="button"
          disabled={busy !== null || title.trim().length < 2}
          onClick={() => void inventOptions()}
          className="end-min__cta"
        >
          {busy === "options" ? "Inventing endings…" : "Invent 3 fan endings →"}
        </button>
      )}

      {options && (
        <>
          <ul className="end-min__choices">
            {options.map((e) => {
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

          <button
            type="button"
            disabled={busy !== null || !selected}
            onClick={() => void generate()}
            className="end-min__cta"
          >
            {busy === "gen" ? "Writing your fan ending…" : "Generate fan ending →"}
          </button>

          <button
            type="button"
            className="end-min__ghost"
            disabled={busy !== null}
            onClick={() => {
              setOptions(null);
              setSelected(null);
            }}
          >
            Try a different title
          </button>
        </>
      )}

      {error && (
        <p className="end-min__err">
          {error}{" "}
          {error.includes("Sign in") && (
            <a href="/sign-in?redirect_url=/end/custom">Sign in →</a>
          )}
        </p>
      )}

      <p className="end-min__legal">
        Unofficial fan art / fan ending. Not affiliated with the original publishers.
      </p>
    </div>
  );
}
