"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import Link from "next/link";
import type { N5Catalog, N5Course, N5Progress } from "../../../../shared/n5/contracts";
import { SECTIONS, STEP_INFO, completedSteps, readLocalSteps, sectionIndex, stepsFor, type StepId } from "@/lib/n5/steps";
import { courseRequest, useCourse } from "./common";

/**
 * Back and forward through a unit's steps, pinned to the bottom of the player.
 * At either end it continues to the previous or next unit.
 */
export function StepBar({ lessonId, steps, step, onStep, previousLessonId, nextLessonId }: { lessonId: string; steps: StepId[]; step: StepId; onStep?: (step: StepId) => void; previousLessonId: string | null; nextLessonId: string | null }) {
  const position = steps.indexOf(step);
  const previous = steps[position - 1];
  const following = steps[position + 1];
  const target = (s: StepId, primary: boolean, children: ReactNode) =>
    onStep && s !== "speak" ? (
      <button type="button" className={primary ? "n5-primary" : undefined} onClick={() => onStep(s)}>
        {children}
      </button>
    ) : (
      <Link className={primary ? "n5-primary" : "n5-secondary"} href={stepHref(lessonId, s)}>
        {children}
      </Link>
    );
  return (
    <nav className="n5-playbar" aria-label="Step navigation">
      <div className="n5-playbar-inner">
        <div className="n5-playbar-side">
          {previous ? (
            target(previous, false, <><Icon name="chevron-left" size={18} /><span><small>Previous</small>{STEP_INFO[previous].label}</span></>)
          ) : previousLessonId ? (
            <Link className="n5-secondary" href={`/app/n5/lessons/${previousLessonId}`}>
              <Icon name="chevron-left" size={18} />
              <span><small>Previous</small>Unit</span>
            </Link>
          ) : null}
        </div>
        <ol className="n5-playbar-dots" aria-label={`Step ${position + 1} of ${steps.length}`}>
          {steps.map((s) => (
            <li key={s} data-current={s === step || undefined} title={STEP_INFO[s].label} />
          ))}
        </ol>
        <div className="n5-playbar-side n5-playbar-next">
          {following ? (
            target(following, true, <><span><small>Next</small>{STEP_INFO[following].label}</span><Icon name="chevron-right" size={18} /></>)
          ) : nextLessonId ? (
            <Link className="n5-primary" href={`/app/n5/lessons/${nextLessonId}`}>
              <span><small>Next</small>Unit</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export interface Overview { catalog: N5Catalog; course: N5Course; progress: N5Progress }

export async function loadOverview(signal: AbortSignal): Promise<Overview> {
  const catalog = await courseRequest<N5Catalog>("/catalog", undefined, undefined, signal);
  const [course, progress] = await Promise.all([
    courseRequest<N5Course>(`/courses/${catalog.courseId}`, undefined, undefined, signal),
    courseRequest<N5Progress>("/me/progress", undefined, undefined, signal),
  ]);
  return { catalog, course, progress };
}

/** Where each step lives: lesson steps are hash routes; speaking has its own page. */
export function stepHref(lessonId: string, step: StepId): string {
  return step === "speak" ? `/app/n5/speak/${lessonId}` : `/app/n5/lessons/${lessonId}#${step}`;
}

function StatusIcon({ state }: { state: "done" | "partial" | "todo" | "current" }) {
  return (
    <span className="n5-check" data-state={state} aria-hidden>
      {state === "done" && <Icon name="check" size={11} />}
    </span>
  );
}

/** Udemy-style course content sidebar: sections → units → steps, with progress. */
function CourseSidebar({ overview, ownerId, lessonId, step, localDone, onStep }: { overview: Overview; ownerId: string; lessonId: string; step: StepId; localDone?: StepId[]; onStep?: (step: StepId) => void }) {
  const { course, progress } = overview;
  const byLesson = new Map((progress.lessons ?? []).map((l) => [l.lessonId, l]));
  const current = course.units.find((u) => u.lessonId === lessonId);
  const [open, setOpen] = useState<Set<number>>(() => new Set([sectionIndex(current?.number ?? 1)]));
  const passed = (progress.lessons ?? []).filter((l) => l.status === "passed").length;
  const percent = Math.round((passed / Math.max(1, course.units.length)) * 100);
  return (
    <nav className="n5-side" aria-label="Course content">
      <div className="n5-side-head">
        <strong>Course content</strong>
        <span className="n5-muted">
          {passed} of {course.units.length} units passed · {percent}%
        </span>
        <span className="n5-bar" aria-hidden>
          <span style={{ width: `${percent}%` }} />
        </span>
      </div>
      {SECTIONS.map((section, index) => {
        const units = course.units.filter((u) => u.number >= section.range[0] && u.number <= section.range[1]);
        const sectionPassed = units.filter((u) => byLesson.get(u.lessonId)?.status === "passed").length;
        const expanded = open.has(index);
        return (
          <section key={section.title} className="n5-side-section">
            <button
              type="button"
              className="n5-side-toggle"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((all) => {
                  const next = new Set(all);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
            >
              <span>
                Section {index + 1}: {section.title}
                <small>
                  {sectionPassed} / {units.length} passed
                </small>
              </span>
              <span className="n5-chevron" aria-hidden>
                <Icon name="chevron" size={14} />
              </span>
            </button>
            {expanded && (
              <ol className="n5-side-units">
                {units.map((u) => {
                  const p = byLesson.get(u.lessonId);
                  const local = u.lessonId === lessonId && localDone ? localDone : readLocalSteps(ownerId, u.lessonId);
                  const done = completedSteps(u.kind, p, local);
                  const steps = stepsFor(u.kind);
                  const isCurrent = u.lessonId === lessonId;
                  const state = p?.status === "passed" ? "done" : isCurrent ? "current" : done.size ? "partial" : "todo";
                  return (
                    <li key={u.id} data-current={isCurrent || undefined}>
                      <Link href={`/app/n5/lessons/${u.lessonId}`} className="n5-side-unit" aria-current={isCurrent ? "page" : undefined}>
                        <StatusIcon state={state} />
                        <span>
                          {u.number}. {u.title}
                          <small>
                            {u.episode ? `Episode ${u.episode.number}` : u.kind === "final" ? "Season final" : "Checkpoint"} · {done.size}/{steps.length} steps
                          </small>
                        </span>
                      </Link>
                      {isCurrent && (
                        <ol className="n5-side-steps">
                          {steps.map((s) => {
                            const body = (
                              <>
                                <StatusIcon state={done.has(s) ? "done" : s === step ? "current" : "todo"} />
                                <span>{STEP_INFO[s].label}</span>
                                <small>{STEP_INFO[s].minutes} min</small>
                              </>
                            );
                            // In-page steps switch without a navigation; a hash-only route change would not.
                            return (
                              <li key={s}>
                                {onStep && s !== "speak" ? (
                                  <button type="button" className="n5-side-step" aria-current={s === step ? "step" : undefined} onClick={() => onStep(s)}>
                                    {body}
                                  </button>
                                ) : (
                                  <Link href={stepHref(u.lessonId, s)} aria-current={s === step ? "step" : undefined} className="n5-side-step">
                                    {body}
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </nav>
  );
}

/**
 * The course player: lesson content beside the course syllabus. On narrow screens
 * the syllabus folds behind a button so the lesson comes first.
 */
export function PlayerShell({ ownerId, lessonId, step, localDone, onStep, children }: { ownerId: string; lessonId: string; step: StepId; localDone?: StepId[]; onStep?: (step: StepId) => void; children: ReactNode }) {
  const load = useCallback((signal: AbortSignal) => loadOverview(signal), []);
  const state = useCourse(load);
  const [showSide, setShowSide] = useState(false);
  // The sidebar is navigation only; if it can't load, the lesson still works.
  const overview = state.data && (state.data as Partial<Overview>).course?.units ? (state.data as Overview) : null;
  return (
    <div className="n5-player" data-side={showSide || undefined}>
      <div className="n5-player-main">{children}</div>
      <aside className="n5-player-side">
        <button type="button" className="n5-side-reveal" aria-expanded={showSide} onClick={() => setShowSide((v) => !v)}>
          {showSide ? "Hide course content" : "Show course content"}
        </button>
        <div className="n5-side-wrap">
          {overview ? <CourseSidebar overview={overview} ownerId={ownerId} lessonId={lessonId} step={step} localDone={localDone} onStep={onStep} /> : (
            <div className="n5-side-loading" aria-label="Loading course content" role="status">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="n5-bone" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          )}
          <Link href="/app/n5" className="n5-side-home">
            <Icon name="home" size={15} /> Course home
          </Link>
        </div>
      </aside>
    </div>
  );
}
