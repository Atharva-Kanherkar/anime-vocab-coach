"use client";

// The Ending Funnel experience: pick a fan ending → watch a 5-panel fan-art
// manga (dialogue lettered into the art) draw itself on the same page → share
// → paywall. Everything happens here; the visitor never sees the Studio.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EndingChoice, FeaturedEndingManga } from "@/lib/ending-hooks";
import { ENDING_PANEL_COUNT } from "@/lib/ending-funnel";
import type { StudioCastMember, StudioPanelScript } from "@/lib/studio";
import type { StyleKey } from "@/lib/cards";
import { checkoutFor } from "@/lib/site";
import { trackMeta, trackMetaCustom } from "@/lib/meta-pixel";
import { trackFunnel } from "./funnel-track";

// ── Types ──────────────────────────────────────────────────────────────────

type GenerateBody =
  | { mangaId: string; endingId: string; customNote?: string }
  | {
      mode: "custom";
      title: string;
      synopsis?: string;
      endingTitle: string;
      tone: string;
      premiseBeat: string;
      styleKey?: StyleKey;
      customNote?: string;
    };

interface ScriptData {
  id: string;
  title: { en: string; sub: string };
  logline: string;
  cast: StudioCastMember[];
  panels: StudioPanelScript[];
  seriesTitle: string;
  endingTitle: string;
  accent: string;
  error?: string;
  paywall?: boolean;
  needsLogin?: boolean;
}

type PanelState =
  | { status: "waiting" }
  | { status: "drawing" }
  | { status: "done"; src: string }
  | { status: "error" };

type Phase = "pick" | "making" | "done" | "paywall";

const ERRORS: Record<string, string> = {
  ai_not_configured: "The manga engine is warming up on this deploy — try again in a minute.",
  manga_not_found: "That series isn't available.",
  ending_not_found: "Pick one of the endings first.",
  title_required: "Type a manga or anime title.",
  capacity: "Today's drawing capacity is maxed out — come back tomorrow, it resets.",
};

const DRAWING_LINES = [
  "Sketching the scene…",
  "Inking the linework…",
  "Lettering the dialogue…",
  "Laying screentones…",
  "Adding color and light…",
];

const WRITING_LINES = [
  "Casting the characters…",
  "Plotting five pages…",
  "Writing the dialogue…",
  "Arguing about the final line…",
  "Choosing where the silence goes…",
];

const LAST_ENDING_KEY = "avc-ending-last";

export function rememberEnding(entry: { id: string; title: string; seriesTitle: string }) {
  try {
    localStorage.setItem(LAST_ENDING_KEY, JSON.stringify(entry));
  } catch {
    /* private mode */
  }
}

export function recallEnding(): { id: string; title: string; seriesTitle: string } | null {
  try {
    const raw = localStorage.getItem(LAST_ENDING_KEY);
    return raw ? (JSON.parse(raw) as { id: string; title: string; seriesTitle: string }) : null;
  } catch {
    return null;
  }
}

// ── Panel drawing hook ─────────────────────────────────────────────────────

function useEndingMaker() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<ScriptData | null>(null);
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [needsLogin, setNeedsLogin] = useState(true);
  const liveRef = useRef(true);
  const doneRef = useRef(0);
  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  const drawPanel = useCallback(async (id: string, i: number) => {
    if (!liveRef.current) return;
    setPanels((prev) => prev.map((p, j) => (j === i ? { status: "drawing" } : p)));
    try {
      const res = await fetch("/api/ending/panel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, i }),
      });
      const data = (await res.json().catch(() => ({}))) as { image?: string };
      if (!res.ok || !data.image) throw new Error("panel_failed");
      if (!liveRef.current) return;
      setPanels((prev) => prev.map((p, j) => (j === i ? { status: "done", src: data.image! } : p)));
      doneRef.current += 1;
      if (doneRef.current >= ENDING_PANEL_COUNT) {
        setPhase("done");
        trackMetaCustom("EndingComplete", {});
      }
    } catch {
      if (!liveRef.current) return;
      setPanels((prev) => prev.map((p, j) => (j === i ? { status: "error" } : p)));
    }
  }, []);

  const start = useCallback(
    async (body: GenerateBody) => {
      setPhase("making");
      setError(null);
      setScript(null);
      doneRef.current = 0;
      setPanels(Array.from({ length: ENDING_PANEL_COUNT }, () => ({ status: "waiting" as const })));
      trackMeta("StartTrial", { content_name: "ending_funnel" });

      let data: ScriptData;
      try {
        const res = await fetch("/api/ending/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        data = (await res.json().catch(() => ({}))) as ScriptData;
        if (res.status === 402 && data.paywall) {
          setNeedsLogin(data.needsLogin !== false);
          setPhase("paywall");
          trackMetaCustom("EndingPaywall", {});
          return;
        }
        if (!res.ok) {
          setPhase("pick");
          setError(ERRORS[data.error ?? ""] ?? "Couldn't start your ending — try again.");
          return;
        }
      } catch {
        setPhase("pick");
        setError("Network hiccup — nothing was used up. Try again.");
        return;
      }

      if (!liveRef.current) return;
      setScript(data);
      rememberEnding({ id: data.id, title: data.title.en, seriesTitle: data.seriesTitle });
      trackMetaCustom("EndingScriptReady", { series: data.seriesTitle.slice(0, 40) });

      // Draw all panels concurrently, staggered so they tend to finish in
      // reading order. Each panel is its own request (Worker-friendly) and
      // idempotent server-side.
      await Promise.all(
        data.panels.slice(0, ENDING_PANEL_COUNT).map(
          (_, i) =>
            new Promise<void>((resolve) => {
              setTimeout(() => {
                void drawPanel(data.id, i).then(resolve);
              }, i * 500);
            })
        )
      );
    },
    [drawPanel]
  );

  const doneCount = panels.filter((p) => p.status === "done").length;

  return { phase, setPhase, error, setError, script, panels, doneCount, start, drawPanel, needsLogin };
}

// ── Shared UI bits ─────────────────────────────────────────────────────────

function ProgressBar({ done, active }: { done: number; active: boolean }) {
  const pct = Math.round((done / ENDING_PANEL_COUNT) * 100);
  return (
    <div className="fnl-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="fnl-progress__bar" style={{ width: `${Math.max(6, pct)}%` }} />
      <span className="fnl-progress__label">
        {active ? `Drawing panel ${Math.min(done + 1, ENDING_PANEL_COUNT)} of ${ENDING_PANEL_COUNT}…` : `${done}/${ENDING_PANEL_COUNT} panels`}
      </span>
    </div>
  );
}

/** The single active slot while a panel is being drawn: page number, rotating
 * craft lines, an "inking" bar, and a teaser of the dialogue about to appear —
 * anticipation instead of a wall of five gray boxes. */
function PanelSkeleton({
  index,
  drawing,
  panel,
  onRetry,
}: {
  index: number;
  drawing: boolean;
  panel: StudioPanelScript;
  onRetry?: () => void;
}) {
  const [tick, setTick] = useState(index % DRAWING_LINES.length);
  useEffect(() => {
    if (!drawing) return;
    const t = setInterval(() => setTick((n) => n + 1), 2600);
    return () => clearInterval(t);
  }, [drawing]);
  const teaser = panel.lines.find((l) => l.kind === "speech" || l.kind === "thought");
  return (
    <div className={"fnl-panel fnl-panel--skeleton" + (drawing ? " is-drawing" : "")}>
      <span className="fnl-panel__page">
        PAGE {index + 1} <em>/ {ENDING_PANEL_COUNT}</em>
      </span>
      {onRetry ? (
        <button type="button" className="fnl-panel__retry" onClick={onRetry}>
          Panel {index + 1} hiccuped — redraw
        </button>
      ) : (
        <div className="fnl-panel__center">
          <span className="fnl-panel__ink" aria-hidden>
            <i />
          </span>
          <span className="fnl-panel__status" aria-live="polite">
            {drawing ? DRAWING_LINES[tick % DRAWING_LINES.length] : "Waiting for the ink to dry…"}
          </span>
          {teaser && (
            <span className="fnl-panel__teaser">
              {teaser.speaker ? `${teaser.speaker} is about to say…` : "Coming up…"}
              <em>“{teaser.text}”</em>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PanelCaption({ panel }: { panel: StudioPanelScript }) {
  if (panel.lines.length === 0) return null;
  return (
    <p className="fnl-panel__caption">
      {panel.lines
        .map((l) => (l.speaker ? `${l.speaker}: “${l.text}”` : `“${l.text}”`))
        .join("  ·  ")}
    </p>
  );
}

function shareUrl(id: string): string {
  return `${window.location.origin}/e/${id}`;
}

function ShareButton({ script }: { script: ScriptData }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    trackFunnel("share_click");
    trackMetaCustom("EndingShare", {});
    const url = shareUrl(script.id);
    const text = `I just made my own ending for ${script.seriesTitle} — "${script.title.en}". How would YOU end it?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: script.title.en, text, url });
        return;
      }
    } catch {
      /* user closed the sheet */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("Copy your ending's link:", url);
    }
  }
  return (
    <button type="button" className="fnl-btn fnl-btn--primary" onClick={() => void share()}>
      {copied ? "Link copied ✓" : "Share your ending"}
    </button>
  );
}

function MakingIntro() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fnl-making-intro">
      <div className="fnl-making-intro__spin" aria-hidden />
      <p className="fnl-making-intro__line">Your mangaka is writing the chapter…</p>
      <p className="fnl-making-intro__sub" aria-live="polite">
        {WRITING_LINES[tick % WRITING_LINES.length]}
      </p>
    </div>
  );
}

// ── The reader (making + done) ─────────────────────────────────────────────

function Reader({
  maker,
  accent,
}: {
  maker: ReturnType<typeof useEndingMaker>;
  accent: string;
}) {
  const { script, panels, doneCount, phase, drawPanel } = maker;
  if (!script) return <MakingIntro />;

  return (
    <div className="fnl-reader" style={{ ["--fnl-accent" as string]: accent }}>
      <header className="fnl-reader__title">
        <p className="fnl-reader__kicker">Fan ending · {script.seriesTitle}</p>
        <h2 className="fnl-reader__h2">{script.title.en}</h2>
        {script.title.sub && <p className="fnl-reader__sub">{script.title.sub}</p>}
        {script.logline && <p className="fnl-reader__logline">{script.logline}</p>}
      </header>

      {phase === "making" && <ProgressBar done={doneCount} active />}

      {(() => {
        // Reveal strictly in reading order: every finished panel, then ONE
        // active slot for the next page — never a wall of five gray boxes.
        // Panels that finish out of order stay hidden until it's their turn.
        const states = script.panels
          .slice(0, ENDING_PANEL_COUNT)
          .map((_, i) => panels[i] ?? { status: "waiting" as const });
        const firstPending = states.findIndex((s) => s.status !== "done");
        const visible = firstPending === -1 ? states.length : firstPending + 1;
        const queued = states.length - visible;
        return (
          <>
            <ol className="fnl-reader__panels">
              {script.panels.slice(0, visible).map((panel, i) => {
                const state = states[i];
                return (
                  <li key={i} className="fnl-reader__panelwrap">
                    {state.status === "done" ? (
                      <>
                        <img
                          className="fnl-panel fnl-panel--art"
                          src={state.src}
                          alt={`Panel ${i + 1}: ${panel.scene.slice(0, 140)}`}
                          loading="lazy"
                        />
                        <PanelCaption panel={panel} />
                      </>
                    ) : (
                      <PanelSkeleton
                        index={i}
                        drawing={state.status === "drawing"}
                        panel={panel}
                        onRetry={
                          state.status === "error" ? () => void drawPanel(script.id, i) : undefined
                        }
                      />
                    )}
                  </li>
                );
              })}
            </ol>
            {phase === "making" && queued > 0 && (
              <p className="fnl-queue-hint">
                {queued} more {queued === 1 ? "page is" : "pages are"} being inked behind this one
              </p>
            )}
          </>
        );
      })()}

      {phase === "done" && <EndCard script={script} />}
      <p className="fnl-legal">Unofficial fan art / fan ending — made by a fan, for fans. Not affiliated with the original publishers.</p>
    </div>
  );
}

function EndCard({ script }: { script: ScriptData }) {
  return (
    <div className="fnl-endcard">
      <p className="fnl-endcard__fin">終 — THE END</p>
      <h3 className="fnl-endcard__h3">That’s your {script.seriesTitle} ending.</h3>
      <p className="fnl-endcard__sub">
        Five panels, drawn for you alone. Send it to the group chat before someone else calls the finale.
      </p>
      <div className="fnl-endcard__ctas">
        <ShareButton script={script} />
        <Link className="fnl-btn fnl-btn--ghost" href="/end">
          Make another ending
        </Link>
      </div>
      <p className="fnl-endcard__fine">
        Your ending lives at a private link — anyone you send it to can read it.
      </p>
    </div>
  );
}

// ── The paywall ────────────────────────────────────────────────────────────

function Paywall({ needsLogin, backHref }: { needsLogin: boolean; backHref: string }) {
  const checkout = checkoutFor("pro");
  const last = typeof window !== "undefined" ? recallEnding() : null;

  useEffect(() => {
    trackMeta("ViewContent", { content_name: "ending_paywall" });
  }, []);

  return (
    <div className="fnl-paywall">
      <p className="fnl-paywall__fin">続く — TO BE CONTINUED</p>
      <h2 className="fnl-paywall__h2">
        {needsLogin ? "That was your free ending." : "You've used this month's endings."}
      </h2>
      <p className="fnl-paywall__sub">
        Every ending is five AI-drawn panels — real art, real cost. Here’s how the story continues:
      </p>

      {needsLogin ? (
        <a
          className="fnl-btn fnl-btn--primary fnl-btn--big"
          href={`/sign-up?redirect_url=${encodeURIComponent(backHref)}`}
          onClick={() => {
            trackFunnel("paywall_signup");
            trackMeta("Lead", { content_name: "ending_paywall_signup" });
          }}
        >
          Create a free account → 3 endings / month
        </a>
      ) : checkout ? null : (
        <p className="fnl-paywall__note">
          Pro (unlimited endings) is almost here — you’ll see it right on this page the day it opens.
        </p>
      )}

      {checkout && (
        <a
          className={"fnl-btn fnl-btn--big " + (needsLogin ? "fnl-btn--ghost" : "fnl-btn--primary")}
          href={checkout}
          onClick={() => {
            trackFunnel("paywall_checkout");
            trackMeta("InitiateCheckout", { content_name: "ending_pro" });
          }}
        >
          Go Pro — $8/mo, endings whenever you want
        </a>
      )}

      <ul className="fnl-paywall__perks">
        <li>Keep every ending saved to your account</li>
        <li>Any series, any finale, your twists</li>
        <li>Same AI mangaka, zero waiting in line</li>
      </ul>

      {last && (
        <p className="fnl-paywall__fine">
          Your ending is safe: <Link href={`/e/${last.id}`}>re-read “{last.title}”</Link>
        </p>
      )}
      <p className="fnl-paywall__fine">
        <Link href="/end">← Back to all series</Link>
      </p>
    </div>
  );
}

// ── Catalog series page (/end/[id]) ────────────────────────────────────────

export function EndingExperience({ manga }: { manga: FeaturedEndingManga }) {
  const maker = useEndingMaker();
  const [selected, setSelected] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");

  function pick(choice: EndingChoice) {
    setSelected(choice.id);
    maker.setError(null);
  }

  function generate() {
    if (!selected) {
      maker.setError("Pick an ending first.");
      return;
    }
    trackFunnel("ending_pick");
    trackMeta("AddToCart", { content_name: "ending_pick", content_id: manga.id });
    void maker.start({ mangaId: manga.id, endingId: selected, customNote: customNote.trim() || undefined });
  }

  if (maker.phase === "paywall") {
    return <Paywall needsLogin={maker.needsLogin} backHref={`/end/${manga.id}`} />;
  }

  if (maker.phase === "making" || maker.phase === "done") {
    return <Reader maker={maker} accent={manga.accent} />;
  }

  return (
    <div className="fnl-pick" style={{ ["--fnl-accent" as string]: manga.accent }}>
      <Link href="/end" className="fnl-back">
        ← All series
      </Link>
      <header className="fnl-pick__head">
        <p className="fnl-kicker">
          Fan ending · {manga.tag} <span className="fnl-badge">FAN ART</span>
        </p>
        <h1 className="fnl-h1">{manga.title}</h1>
        <p className="fnl-jp">{manga.subtitle}</p>
        <p className="fnl-lede">{manga.synopsis}</p>
        <p className="fnl-cliff">{manga.cliffhanger}</p>
      </header>

      <ul className="fnl-choices">
        {manga.endings.map((e) => {
          const on = selected === e.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => pick(e)}
                className={"fnl-choice" + (on ? " is-on" : "")}
                aria-pressed={on}
              >
                <span className="fnl-choice__title">{e.title}</span>
                <span className="fnl-choice__blurb">{e.blurb}</span>
                <span className="fnl-choice__tone">{e.tone}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <label className="fnl-note">
        <span>Add your twist (optional)</span>
        <textarea
          value={customNote}
          onChange={(ev) => setCustomNote(ev.target.value.slice(0, 280))}
          rows={2}
          placeholder="One sentence — the beat only you would write"
        />
      </label>

      {maker.error && <p className="fnl-err">{maker.error}</p>}

      <button
        type="button"
        className="fnl-btn fnl-btn--primary fnl-btn--big fnl-btn--block"
        disabled={!selected}
        onClick={generate}
      >
        Draw my ending — free
      </button>
      <p className="fnl-fine">5 manga panels · dialogue and all · about 2 minutes</p>
      <p className="fnl-legal">Unofficial fan art / fan ending. Not affiliated with the original publishers.</p>
    </div>
  );
}

// ── Custom any-title page (/end/custom) ────────────────────────────────────

interface CustomOption {
  id: string;
  title: string;
  blurb: string;
  tone: string;
  premiseBeat: string;
}

export function CustomEndingExperience() {
  const maker = useEndingMaker();
  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [styleKey, setStyleKey] = useState<StyleKey>("slayer");
  const [options, setOptions] = useState<CustomOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function inventOptions() {
    const t = title.trim();
    if (t.length < 2) {
      maker.setError("Type a manga or anime title.");
      return;
    }
    setBusy(true);
    maker.setError(null);
    setOptions(null);
    setSelected(null);
    trackMetaCustom("CustomEndingTitle", { title: t.slice(0, 40) });
    try {
      const res = await fetch("/api/ending/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: t, synopsis: synopsis.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        options?: CustomOption[];
        styleKey?: StyleKey;
        error?: string;
      };
      if (!res.ok || !data.options) {
        maker.setError(ERRORS[data.error ?? ""] ?? "Couldn't invent endings — try again.");
        return;
      }
      setOptions(data.options);
      if (data.styleKey) setStyleKey(data.styleKey);
    } catch {
      maker.setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  function generate() {
    const choice = options?.find((o) => o.id === selected);
    if (!choice) {
      maker.setError("Pick an ending first.");
      return;
    }
    trackFunnel("ending_pick");
    trackMeta("AddToCart", { content_name: "ending_pick", content_id: "custom" });
    void maker.start({
      mode: "custom",
      title: title.trim(),
      synopsis: synopsis.trim() || undefined,
      endingTitle: choice.title,
      tone: choice.tone,
      premiseBeat: choice.premiseBeat,
      styleKey,
      customNote: customNote.trim() || undefined,
    });
  }

  if (maker.phase === "paywall") {
    return <Paywall needsLogin={maker.needsLogin} backHref="/end/custom" />;
  }
  if (maker.phase === "making" || maker.phase === "done") {
    return <Reader maker={maker} accent="#e8a54b" />;
  }

  return (
    <div className="fnl-pick">
      <Link href="/end" className="fnl-back">
        ← All series
      </Link>
      <header className="fnl-pick__head">
        <p className="fnl-kicker">
          Fan ending · any title <span className="fnl-badge">FAN ART</span>
        </p>
        <h1 className="fnl-h1">Type any manga</h1>
        <p className="fnl-lede">
          Name a series. Our AI invents three fan endings — pick one and watch it get drawn.
        </p>
      </header>

      <label className="fnl-note">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(ev) => setTitle(ev.target.value.slice(0, 80))}
          placeholder="e.g. Berserk, Vinland Saga, Your Name…"
          disabled={busy}
        />
      </label>
      <label className="fnl-note">
        <span>Where the story left off (optional)</span>
        <textarea
          value={synopsis}
          onChange={(ev) => setSynopsis(ev.target.value.slice(0, 500))}
          rows={2}
          placeholder="After the finale…"
          disabled={busy}
        />
      </label>

      {!options && (
        <button
          type="button"
          className="fnl-btn fnl-btn--primary fnl-btn--big fnl-btn--block"
          disabled={busy || title.trim().length < 2}
          onClick={() => void inventOptions()}
        >
          {busy ? "Inventing endings…" : "Invent 3 fan endings →"}
        </button>
      )}

      {options && (
        <>
          <ul className="fnl-choices">
            {options.map((e) => {
              const on = selected === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(e.id);
                      maker.setError(null);
                    }}
                    className={"fnl-choice" + (on ? " is-on" : "")}
                    aria-pressed={on}
                  >
                    <span className="fnl-choice__title">{e.title}</span>
                    <span className="fnl-choice__blurb">{e.blurb}</span>
                    <span className="fnl-choice__tone">{e.tone}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <label className="fnl-note">
            <span>Add your twist (optional)</span>
            <textarea
              value={customNote}
              onChange={(ev) => setCustomNote(ev.target.value.slice(0, 280))}
              rows={2}
              placeholder="One sentence — the beat only you would write"
            />
          </label>

          <button
            type="button"
            className="fnl-btn fnl-btn--primary fnl-btn--big fnl-btn--block"
            disabled={!selected}
            onClick={generate}
          >
            Draw my ending — free
          </button>
          <button
            type="button"
            className="fnl-ghostlink"
            onClick={() => {
              setOptions(null);
              setSelected(null);
            }}
          >
            Try a different title
          </button>
        </>
      )}

      {maker.error && <p className="fnl-err">{maker.error}</p>}
      <p className="fnl-legal">Unofficial fan art / fan ending. Not affiliated with the original publishers.</p>
    </div>
  );
}
