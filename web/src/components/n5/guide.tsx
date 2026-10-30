"use client";

import { useEffect, useRef, useState } from "react";
import type { N5Script } from "../../../../shared/n5/contracts";
import { STEP_GUIDE, STEP_INFO, type StepId } from "@/lib/n5/steps";
import { Icon, type IconName } from "./icons";

export const GUIDE_KEY = "avc:n5:guide:v1";
export function guideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === "seen";
  } catch {
    return true;
  }
}
function markGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, "seen");
  } catch {
    /* the guide just shows again next time */
  }
}

const STEP_ICON: Record<StepId, IconName> = { learn: "book", drill: "bolt", watch: "film", practice: "clipboard", speak: "mic" };
const ORDER: StepId[] = ["learn", "drill", "watch", "practice", "speak"];
const SLIDES = ["Welcome", "Japanese display", "The five steps", "Watching", "Passing"] as const;

/**
 * The course guide: a short tour shown once on the course home, and any time from
 * "How this course works". With `onScript` it also asks for the display script, and
 * with `onStart` it ends by opening the learner's next unit.
 */
export function CourseGuide({
  open,
  onClose,
  script,
  onScript,
  startLabel,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  script?: N5Script | null;
  onScript?: (script: N5Script) => void;
  startLabel?: string;
  onStart?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    // Browsers without modal dialogs still show the guide, just without the backdrop.
    if (open && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    }
    if (!open && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
  }, [open]);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [index, open]);
  function close() {
    markGuideSeen();
    setIndex(0);
    onClose();
  }
  const last = index === SLIDES.length - 1;
  const needsScript = index === 1 && Boolean(onScript) && !script;
  return (
    <dialog
      ref={dialog}
      className="n5-guide"
      aria-labelledby="n5-guide-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="n5-guide-top">
        <span className="n5-eyebrow">
          Course guide · {index + 1} of {SLIDES.length}
        </span>
        <button type="button" className="n5-link n5-guide-skip" onClick={close}>
          {last ? "Close" : "Skip guide"}
        </button>
      </div>
      <ol className="n5-guide-dots" aria-label="Guide pages">
        {SLIDES.map((title, i) => (
          <li key={title}>
            <button type="button" aria-label={`${title}, page ${i + 1}`} aria-current={i === index ? "step" : undefined} data-done={i < index || undefined} onClick={() => setIndex(i)} />
          </li>
        ))}
      </ol>
      <div className="n5-guide-body">
        {index === 0 && (
          <>
            <h2 id="n5-guide-title" ref={heading} tabIndex={-1}>
              Welcome to your Japanese course
            </h2>
            <p className="n5-guide-lead">You&apos;ll learn beginner Japanese through Your Lie in April, one episode at a time. You don&apos;t need to know any Japanese to start.</p>
            <ul className="n5-guide-facts">
              <li>
                <Icon name="layers" size={18} />
                <span>
                  <strong>24 units in 4 sections</strong>
                  <small>From introductions to real conversations, at JLPT N5 level.</small>
                </span>
              </li>
              <li>
                <Icon name="film" size={18} />
                <span>
                  <strong>One unit per episode</strong>
                  <small>22 episode units, plus a checkpoint and a season final.</small>
                </span>
              </li>
              <li>
                <Icon name="clock" size={18} />
                <span>
                  <strong>About 30 minutes of study per unit</strong>
                  <small>Plus the episode itself. Do one unit a day, or at your own pace.</small>
                </span>
              </li>
            </ul>
          </>
        )}
        {index === 1 && (
          <>
            <h2 id="n5-guide-title" ref={heading} tabIndex={-1}>
              Choose how Japanese is shown
            </h2>
            <p className="n5-guide-lead">Every word and sentence appears in one script only, never mixed. You can switch any time from the course page.</p>
            {onScript ? (
              <fieldset className="n5-guide-scripts">
                <legend className="n5-visually-hidden">Japanese display</legend>
                {(["romaji", "kana"] as const).map((s) => (
                  <label key={s} data-checked={script === s}>
                    <input type="radio" name="guide-script" value={s} checked={script === s} onChange={() => onScript(s)} />
                    <strong>{s === "romaji" ? "Romaji" : "Kana"}</strong>
                    <span data-owned-japanese lang={s === "kana" ? "ja" : undefined} className="n5-guide-sample">
                      {s === "romaji" ? "konnichiwa" : "こんにちは"}
                    </span>
                    <small>{s === "romaji" ? "Japanese in Latin letters. Best if you can't read Japanese yet." : "Hiragana and katakana. Best if you already know them, or want to learn them now."}</small>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p>Romaji writes Japanese in Latin letters; kana uses hiragana and katakana. Change it from the course page.</p>
            )}
            {needsScript && <p className="n5-muted">Choose one to continue.</p>}
          </>
        )}
        {index === 2 && (
          <>
            <h2 id="n5-guide-title" ref={heading} tabIndex={-1}>
              Every unit has five steps
            </h2>
            <p className="n5-guide-lead">Follow them in order. The steps build on each other, but nothing is locked.</p>
            <ol className="n5-guide-steps">
              {ORDER.map((s, i) => (
                <li key={s}>
                  <span className="n5-how-icon">
                    <Icon name={STEP_ICON[s]} size={16} />
                  </span>
                  <span>
                    <strong>
                      {i + 1}. {STEP_INFO[s].label} <small>· {STEP_INFO[s].minutes} min</small>
                    </strong>
                    <small>{STEP_GUIDE[s].why}</small>
                  </span>
                </li>
              ))}
            </ol>
            <p className="n5-muted">The checkpoint and the season final have no episode, so they skip Watch.</p>
          </>
        )}
        {index === 3 && (
          <>
            <h2 id="n5-guide-title" ref={heading} tabIndex={-1}>
              Watching the episodes
            </h2>
            <p className="n5-guide-lead">The course doesn&apos;t include the show itself. Each unit links to official services that stream the episode.</p>
            <ul className="n5-guide-list">
              <li>Links include Netflix, U-NEXT, Crunchyroll, Prime Video and Hulu, with services in your region listed first.</li>
              <li>You&apos;ll need your own subscription. Availability depends on your country.</li>
              <li>Watch with Japanese audio. Subtitles in your language are fine; listen for the words you just learned.</li>
              <li>Afterwards, mark it watched and read the short recap before Practice.</li>
            </ul>
          </>
        )}
        {index === 4 && (
          <>
            <h2 id="n5-guide-title" ref={heading} tabIndex={-1}>
              Passing and progress
            </h2>
            <ul className="n5-guide-list">
              <li>
                <strong>Pass a unit</strong>{" "}by scoring 80% in Practice. Retake it as often as you like.
              </li>
              <li>
                <strong>Speaking counts</strong>{" "}once you&apos;ve spoken at least three replies aloud to Haru. Typed replies are still good practice.
              </li>
              <li>
                <strong>Your progress is saved</strong>{" "}to your account, and the course page always shows what&apos;s up next.
              </li>
            </ul>
            <div className="n5-guide-first">
              <span className="n5-eyebrow">Your first session</span>
              <p>Start with Unit 1: Learn and Drill take about 12 minutes. Then watch episode 1 when you have time, and come back for Practice and Speak.</p>
            </div>
          </>
        )}
      </div>
      <div className="n5-guide-nav">
        {index > 0 ? (
          <button type="button" onClick={() => setIndex((i) => i - 1)}>
            Back
          </button>
        ) : (
          <span />
        )}
        {!last ? (
          <button type="button" className="n5-primary" disabled={needsScript} onClick={() => setIndex((i) => i + 1)}>
            Next
          </button>
        ) : onStart ? (
          <button
            type="button"
            className="n5-primary"
            disabled={Boolean(onScript) && !script}
            onClick={() => {
              close();
              onStart();
            }}
          >
            {startLabel ?? "Start"}
          </button>
        ) : (
          <button type="button" className="n5-primary" onClick={close}>
            Got it
          </button>
        )}
      </div>
    </dialog>
  );
}

/** What to do on this step, with the reason behind its place in the unit. */
export function StepGuide({ step, position, total, onGuide }: { step: StepId; position: number; total: number; onGuide?: () => void }) {
  return (
    <aside className="n5-step-guide" aria-label="What to do in this step">
      <span className="n5-how-icon" aria-hidden>
        <Icon name={STEP_ICON[step]} size={16} />
      </span>
      <div>
        <p className="n5-step-guide-title">
          Step {position} of {total}: {STEP_INFO[step].label} <span className="n5-muted">· about {STEP_INFO[step].minutes} min</span>
        </p>
        <p>{STEP_GUIDE[step].todo}</p>
        <details>
          <summary>Why this step comes here</summary>
          <p>{STEP_GUIDE[step].why}</p>
          {onGuide && (
            <button type="button" className="n5-link" onClick={onGuide}>
              How this course works
            </button>
          )}
        </details>
      </div>
    </aside>
  );
}
