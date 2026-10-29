"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  N5Catalog,
  N5Course,
  N5Enrolment,
  N5LessonProgress,
  N5Progress,
  N5Script,
} from "../../../../shared/n5/contracts";
import { courseRequest, Failure, Loading, newKey, useCourse } from "./common";

async function load(signal: AbortSignal) {
  const catalog = await courseRequest<N5Catalog>("/catalog", undefined, undefined, signal);
  const [course, progress] = await Promise.all([
    courseRequest<N5Course>(`/courses/${catalog.courseId}`, undefined, undefined, signal),
    courseRequest<N5Progress>("/me/progress", undefined, undefined, signal),
  ]);
  return { catalog, course, progress };
}

export function CourseHub() {
  const state = useCourse(load);
  if (state.error)
    return (
      <>
        <Failure error={state.error} />
        <button onClick={() => location.reload()}>Retry loading course</button>
      </>
    );
  if (!state.data) return <Loading />;
  return <HubContent {...state.data} />;
}

const STATUS_LABEL: Record<N5LessonProgress["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  practised: "Practised",
  passed: "Passed",
};
const SPEAKING_LABEL: Record<N5LessonProgress["speaking"], string | null> = {
  not_started: null,
  practice_only: "Typed practice",
  needs_practice: "Speaking: keep going",
  demonstrated: "Speaking ✓",
};
const SECTIONS = [
  { title: "First meetings", range: [1, 6] },
  { title: "Daily life", range: [7, 12] },
  { title: "Plans and requests", range: [13, 18] },
  { title: "Real conversations", range: [19, 24] },
] as const;

function HubContent({ catalog, course, progress }: Awaited<ReturnType<typeof load>>) {
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
  const nextId = progress.nextLessonId ?? course.units[0]?.lessonId;
  const next = course.units.find((u) => u.lessonId === nextId) ?? course.units[0];
  const active = progress.attempts.filter((a) => a.status === "active").reverse();

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
      await courseRequest<N5Enrolment>(
        "/enrolments",
        { trackId: pilot.id, script, idempotencyKey: requestKey },
        undefined,
        abort.current.signal,
      );
      router.push(`/app/n5/lessons/${lessonId}?script=${script}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <>
      <section className="n5-hero n5-hero-hub">
        <div>
          <p className="n5-eyebrow">Your Lie in April · JLPT N5 foundations</p>
          <h1>Learn Japanese one episode at a time.</h1>
          <p className="n5-lead">
            24 guided units. Each one goes learn → drill → watch → practise → speak with an AI tutor, in the script you choose.
          </p>
        </div>
        <div className="n5-ring" style={{ ["--n5-progress" as string]: `${(passed / Math.max(1, course.units.length)) * 360}deg` }} aria-label={`${passed} of ${course.units.length} units passed`}>
          <strong>{passed}</strong>
          <span>of {course.units.length} passed</span>
        </div>
      </section>

      <section className="n5-panel n5-continue">
        <div className="n5-continue-main">
          <p className="n5-eyebrow">{progress.enrolment ? "Up next" : "Start here"}</p>
          {next && (
            <>
              <h2>
                Unit {next.number}: {next.title}
              </h2>
              <p className="n5-muted">
                {next.episode ? `Episode ${next.episode.number} · ${next.episode.title}` : next.kind === "final" ? "Season final" : "Study unit and checkpoint"}
              </p>
            </>
          )}
        </div>
        <fieldset disabled={Boolean(busy)} className="n5-segmented" aria-describedby="n5-script-help">
          <legend>Japanese display</legend>
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
              <span>{s === "romaji" ? "Romaji" : "Kana"}</span>
              <small data-owned-japanese lang={s === "kana" ? "ja" : undefined}>
                {s === "romaji" ? "konnichiwa" : "こんにちは"}
              </small>
            </label>
          ))}
        </fieldset>
        <p id="n5-script-help" className="n5-muted">
          One script everywhere, never mixed. You can switch between lessons; each practice keeps the script it started with.
        </p>
        {Boolean(error) && <Failure error={error} />}
        <button
          className="n5-primary n5-big"
          disabled={!script || !pilot || !next || Boolean(busy)}
          onClick={() => next && open(next.lessonId)}
        >
          {busy === next?.lessonId ? "Opening…" : progress.enrolment ? `Continue: Unit ${next?.number}` : "Start Unit 1"}
        </button>
        {!script && <p className="n5-muted">Choose romaji or kana to begin.</p>}
      </section>

      {active.length > 0 && (
        <section className="n5-panel">
          <h2>Pick up where you left off</h2>
          {active.map((a) => (
            <Link className="n5-resume" key={a.id} href={`/app/n5/attempts/${a.id}`}>
              Resume unfinished {a.script} practice
              {a.lessonId ? ` · Unit ${course.units.find((u) => u.lessonId === a.lessonId)?.number ?? "?"}` : ""}
              <span aria-hidden>→</span>
            </Link>
          ))}
        </section>
      )}

      <section aria-labelledby="n5-path-title">
        <h2 id="n5-path-title" className="n5-section-title">
          Your path
        </h2>
        {SECTIONS.map((section) => (
          <div key={section.title} className="n5-path-section">
            <h3>
              {section.title}
              <small>
                Units {section.range[0]}–{section.range[1]}
              </small>
            </h3>
            <ol className="n5-path">
              {course.units
                .filter((u) => u.number >= section.range[0] && u.number <= section.range[1])
                .map((u) => {
                  const p = byLesson.get(u.lessonId);
                  const status = p?.status ?? "not_started";
                  const speaking = p ? SPEAKING_LABEL[p.speaking] : null;
                  return (
                    <li key={u.id} data-status={status} data-next={u.lessonId === next?.lessonId || undefined}>
                      <button
                        type="button"
                        className="n5-path-node"
                        disabled={!script || Boolean(busy)}
                        onClick={() => open(u.lessonId)}
                        aria-label={`Unit ${u.number}: ${u.title}. ${STATUS_LABEL[status]}`}
                      >
                        <span className="n5-node-dot" aria-hidden>
                          {status === "passed" ? "✓" : u.kind === "final" ? "★" : u.kind === "study" ? "◆" : u.number}
                        </span>
                        <span className="n5-node-body">
                          <strong>{u.title}</strong>
                          <small>
                            {u.episode ? `Ep ${u.episode.number} · ${u.episode.title}` : u.kind === "final" ? "Season final" : "Checkpoint"}
                          </small>
                        </span>
                        <span className="n5-node-meta">
                          {p?.bestPercent != null && <span className="n5-chip">{Math.round(p.bestPercent)}%</span>}
                          {speaking && <span className="n5-chip n5-chip-soft">{speaking}</span>}
                          {status !== "passed" && status !== "not_started" && <span className="n5-chip n5-chip-soft">{STATUS_LABEL[status]}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ol>
          </div>
        ))}
      </section>

      <section className="n5-panel">
        <p className="n5-eyebrow">More stories</p>
        <h2>Other anime tracks are coming.</h2>
        <div className="n5-tracks">
          {catalog.tracks.map((t) => (
            <article key={t.id} data-active={t.status !== "planned" || undefined}>
              <h3>{t.title}</h3>
              <p className="n5-muted">
                {t.adaptation} · Season {t.season}
              </p>
              <span className="n5-chip n5-chip-soft">{t.status === "planned" ? "Planned" : "Available now"}</span>
            </article>
          ))}
        </div>
        <p className="n5-muted">{course.limitation}</p>
      </section>
    </>
  );
}
