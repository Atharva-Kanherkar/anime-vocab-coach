"use client";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { N5Enrolment, N5LessonProgress, N5Script } from "../../../../shared/n5/contracts";
import { SECTIONS, STEP_INFO, completedSteps, readLocalSteps, sectionIndex, stepsFor, type StepId } from "@/lib/n5/steps";
import { courseRequest, Failure, Loading, newKey, useCourse } from "./common";
import { loadOverview, type Overview } from "./player";

export function CourseHub({ ownerId = "" }: { ownerId?: string }) {
  const state = useCourse(loadOverview);
  if (state.error)
    return (
      <div className="n5-wrap">
        <Failure error={state.error} />
        <button onClick={() => location.reload()}>Retry loading course</button>
      </div>
    );
  if (!state.data) return <Loading />;
  return <HubContent {...state.data} ownerId={ownerId} />;
}

const STATUS_LABEL: Record<N5LessonProgress["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  practised: "Practised",
  passed: "Passed",
};
const OUTCOMES = [
  "Introduce yourself and ask who people are",
  "Talk about family, belongings and where things are",
  "Tell the time, describe routines and what you did",
  "Shop, order and ask prices",
  "Describe people and say what you like",
  "Invite, make plans, ask favours and permission",
  "Follow casual anime speech and answer politely",
  "Give reasons, compare, and handle new situations",
];
const INCLUDES = [
  ["headphones", "Audio for every word and sentence"],
  ["chat", "AI speaking partner in every unit"],
  ["pencil", "AI feedback on your written answers"],
  ["film", "Recaps for all 22 episodes"],
  ["type", "Romaji or kana, never mixed"],
] as const satisfies readonly (readonly [IconName, string])[];
export const STEP_ICON: Record<StepId, IconName> = { learn: "book", drill: "bolt", watch: "film", practice: "clipboard", speak: "mic" };

function HubContent({ catalog, course, progress, ownerId }: Overview & { ownerId: string }) {
  const router = useRouter();
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const [script, setScript] = useState<N5Script | null>(progress.enrolment?.script ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [key, setKey] = useState<string | null>(null);
  const pilot = catalog.tracks.find((t) => t.status === "unreviewed_preview");
  const lessons = progress.lessons ?? [];
  const byLesson = new Map(lessons.map((l) => [l.lessonId, l]));
  const passed = lessons.filter((l) => l.status === "passed").length;
  const total = course.units.length;
  const percent = Math.round((passed / Math.max(1, total)) * 100);
  const nextId = progress.nextLessonId ?? course.units[0]?.lessonId;
  const next = course.units.find((u) => u.lessonId === nextId) ?? course.units[0];
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => new Set([sectionIndex(next?.number ?? 1)]));
  const active = progress.attempts.filter((a) => a.status === "active").reverse();
  const planned = catalog.tracks.filter((t) => t.status === "planned");
  const speakingDone = lessons.filter((l) => l.speaking === "demonstrated").length;
  const minutes = course.units.reduce((sum, u) => sum + stepsFor(u.kind).reduce((m, s) => m + STEP_INFO[s].minutes, 0), 0);
  const words = course.units.length * 10;

  /** Reconcile the chosen script on every explicit action: initial progress can be stale. */
  async function open(lessonId: string) {
    if (!script || !pilot || lock.current) return;
    lock.current = true;
    abort.current = new AbortController();
    setBusy(lessonId);
    setError(null);
    const requestKey = key ?? newKey();
    setKey(requestKey);
    try {
      await courseRequest<N5Enrolment>("/enrolments", { trackId: pilot.id, script, idempotencyKey: requestKey }, undefined, abort.current.signal);
      router.push(`/app/n5/lessons/${lessonId}?script=${script}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  const toggle = (index: number) =>
    setExpandedSections((all) => {
      const nextOpen = new Set(all);
      if (nextOpen.has(index)) nextOpen.delete(index);
      else nextOpen.add(index);
      return nextOpen;
    });
  const allOpen = expandedSections.size === SECTIONS.length;

  const card = (
    <aside className="n5-course-card" aria-label="Your course">
      <div className="n5-cover" aria-hidden>
        <span className="n5-cover-label">JLPT N5 · Season 1</span>
        <span className="n5-cover-title">Your Lie in April</span>
        <span className="n5-cover-keys" />
      </div>
      <div className="n5-card-body">
        <div className="n5-card-progress">
          <div>
            <strong>{percent}%</strong> complete
          </div>
          <span className="n5-muted">
            {passed}/{total} units passed{speakingDone ? ` · ${speakingDone} spoken` : ""}
          </span>
          <span className="n5-bar" aria-hidden>
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        <div className="n5-field">
          <span className="n5-field-label" aria-hidden>
            Japanese display
          </span>
          <fieldset disabled={Boolean(busy)} className="n5-toggle n5-toggle-wide">
            <legend className="n5-visually-hidden">Japanese display</legend>
            {(["romaji", "kana"] as const).map((s) => (
              <label key={s} data-checked={script === s}>
                <input
                  type="radio"
                  name="course-script"
                  value={s}
                  checked={script === s}
                  onChange={() => {
                    setScript(s);
                    setKey(null);
                  }}
                />
                {s === "romaji" ? "Romaji" : "Kana"}
                <small data-owned-japanese lang={s === "kana" ? "ja" : undefined}>
                  {s === "romaji" ? "aiueo" : "あいうえお"}
                </small>
              </label>
            ))}
          </fieldset>
        </div>
        {next && (
          <div className="n5-card-next">
            <span className="n5-eyebrow">{progress.enrolment ? "Up next" : "Start here"}</span>
            <strong>
              Unit {next.number}: {next.title}
            </strong>
            <small className="n5-muted">{next.episode ? `Episode ${next.episode.number} · ${next.episode.title}` : next.kind === "final" ? "Season final" : "Checkpoint unit"}</small>
          </div>
        )}
        {Boolean(error) && <Failure error={error} />}
        <button className="n5-primary n5-big n5-block" disabled={!script || !pilot || !next || Boolean(busy)} onClick={() => next && open(next.lessonId)}>
          {busy === next?.lessonId ? "Opening…" : progress.enrolment ? `Continue: Unit ${next?.number}` : "Start Unit 1"}
        </button>
        {!script && <p className="n5-muted n5-center">Choose romaji or kana to begin.</p>}
        <p className="n5-card-includes-title">This course includes</p>
        <ul className="n5-card-includes">
          {INCLUDES.map(([icon, text]) => (
            <li key={text}>
              <Icon name={icon} />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );

  return (
    <div className="n5-course-home">
      <section className="n5-course-hero">
        <div className="n5-wrap n5-hero-inner">
          <nav className="n5-crumbs" aria-label="Breadcrumb">
            <Link href="/app">AnimeVocab</Link> <span aria-hidden>›</span> Japanese <span aria-hidden>›</span> JLPT N5
          </nav>
          <h1>Japanese for Beginners: JLPT N5 with Your Lie in April</h1>
          <p className="n5-hero-sub">Learn real beginner Japanese one episode at a time: study the words, watch the episode, practise, then speak with an AI partner.</p>
          <div className="n5-hero-tags">
            <span className="n5-pill">Beginner</span>
            <span className="n5-pill">Romaji or kana</span>
            <span className="n5-pill n5-pill-warn">Unreviewed preview</span>
          </div>
          <ul className="n5-hero-meta">
            <li>{total} units</li>
            <li>22 episodes</li>
            <li>{words}+ words</li>
            <li>~{Math.round(minutes / 60)} hours</li>
            <li>AI speaking practice</li>
          </ul>
        </div>
      </section>

      <div className="n5-wrap n5-home-grid">
        {card}
        <div className="n5-home-main">

          {active.length > 0 && (
            <section className="n5-box n5-resume-box">
              <h2>Pick up where you left off</h2>
              {active.map((a) => (
                <Link key={a.id} className="n5-resume" href={`/app/n5/attempts/${a.id}`}>
                  Resume unfinished {a.script} practice
                  {a.lessonId ? ` · Unit ${course.units.find((u) => u.lessonId === a.lessonId)?.number ?? "?"}` : ""}
                  <span aria-hidden>→</span>
                </Link>
              ))}
            </section>
          )}

          <section className="n5-box n5-learn-box">
            <h2>What you&apos;ll learn</h2>
            <ul className="n5-outcomes">
              {OUTCOMES.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>

          <section className="n5-syllabus" aria-labelledby="n5-content-title">
            <div className="n5-syllabus-head">
              <h2 id="n5-content-title">Course content</h2>
              <span className="n5-muted">
                {SECTIONS.length} sections · {total} units · 22 episodes
              </span>
              <button type="button" className="n5-link" onClick={() => setExpandedSections(allOpen ? new Set() : new Set(SECTIONS.map((_, i) => i)))}>
                {allOpen ? "Collapse all sections" : "Expand all sections"}
              </button>
            </div>
            <div className="n5-syllabus-body">
              {SECTIONS.map((section, index) => {
                const units = course.units.filter((u) => u.number >= section.range[0] && u.number <= section.range[1]);
                const sectionPassed = units.filter((u) => byLesson.get(u.lessonId)?.status === "passed").length;
                const expanded = expandedSections.has(index);
                return (
                  <section key={section.title} className="n5-syl-section">
                    <button type="button" className="n5-syl-toggle" aria-expanded={expanded} onClick={() => toggle(index)}>
                      <span className="n5-chevron" aria-hidden>
                <Icon name="chevron" size={14} />
              </span>
                      <strong>
                        Section {index + 1}: {section.title}
                      </strong>
                      <span className="n5-muted">
                        {sectionPassed}/{units.length} passed · {units.length} units
                      </span>
                    </button>
                    {expanded && (
                      <ol className="n5-syl-units">
                        {units.map((u) => {
                          const p = byLesson.get(u.lessonId);
                          const status = p?.status ?? "not_started";
                          const done = completedSteps(u.kind, p, ownerId ? readLocalSteps(ownerId, u.lessonId) : []);
                          const steps = stepsFor(u.kind);
                          const isNext = u.lessonId === next?.lessonId;
                          return (
                            <li key={u.id} data-status={status} data-next={isNext || undefined}>
                              <button
                                type="button"
                                className="n5-syl-unit"
                                disabled={!script || Boolean(busy)}
                                onClick={() => open(u.lessonId)}
                                aria-label={`Unit ${u.number}: ${u.title}. ${STATUS_LABEL[status]}`}
                              >
                                <span className="n5-check" data-state={status === "passed" ? "done" : isNext ? "current" : done.size ? "partial" : "todo"} aria-hidden>
                                  {status === "passed" && <Icon name="check" size={12} />}
                                </span>
                                <span className="n5-syl-text">
                                  <strong>
                                    Unit {u.number}: {u.title}
                                  </strong>
                                  <small>{u.episode ? `Episode ${u.episode.number} · ${u.episode.title}` : u.kind === "final" ? "Season final · cumulative test" : "Checkpoint · review of units 1–11"}</small>
                                </span>
                                <span className="n5-syl-steps" aria-hidden title={`${done.size} of ${steps.length} steps done`}>
                                  {steps.map((s) => (
                                    <span key={s} data-done={done.has(s) || undefined} />
                                  ))}
                                </span>
                                <span className="n5-syl-meta">
                                  {isNext ? <span className="n5-next-label">Up next</span> : p?.bestPercent != null ? <span>{Math.round(p.bestPercent)}%</span> : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </section>
                );
              })}
            </div>
          </section>

          <section className="n5-box">
            <h2>How each unit works</h2>
            <ol className="n5-how">
              {(["learn", "drill", "watch", "practice", "speak"] as const).map((s, i) => (
                <li key={s}>
                  <span className="n5-how-icon">
                    <Icon name={STEP_ICON[s]} size={18} />
                  </span>
                  <strong>
                    {i + 1}. {STEP_INFO[s].label}
                  </strong>
                  <small>{STEP_INFO[s].blurb}</small>
                </li>
              ))}
            </ol>
            <p className="n5-muted">Score 80% in Practice to pass a unit. Speaking counts once you&apos;ve spoken at least three replies aloud.</p>
          </section>

          <section className="n5-about">
            <h2>Good to know</h2>
            <ul>
              <li>Watch on your own Crunchyroll subscription; availability depends on your region.</li>
              <li>All example sentences and questions are original practice material, not lines from the show.</li>
              <li>{course.limitation}</li>
            </ul>
            <p className="n5-muted">
              More anime tracks are planned:{" "}
              {planned.map((t, i) => (
                <span key={t.id}>
                  {i > 0 && ", "}
                  {t.title}
                </span>
              ))}
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
