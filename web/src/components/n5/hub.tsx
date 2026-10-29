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
  const total = course.units.length;
  const nextId = progress.nextLessonId ?? course.units[0]?.lessonId;
  const next = course.units.find((u) => u.lessonId === nextId) ?? course.units[0];
  const active = progress.attempts.filter((a) => a.status === "active").reverse();
  const planned = catalog.tracks.filter((t) => t.status === "planned");

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
    <div className="n5-map-page">
      <header className="n5-map-head">
        <div>
          <p className="n5-eyebrow">Your Lie in April · JLPT N5</p>
          <h1>Course map</h1>
        </div>
        <div className="n5-map-meter" aria-label={`${passed} of ${total} units passed`}>
          <span>
            <strong>{passed}</strong>/{total} passed
          </span>
          <span className="n5-bar" aria-hidden>
            <span style={{ width: `${(passed / Math.max(1, total)) * 100}%` }} />
          </span>
        </div>
        <fieldset disabled={Boolean(busy)} className="n5-toggle">
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
      </header>

      {next && (
        <section className="n5-next" aria-label="Up next">
          <span className="n5-next-unit" aria-hidden>
            {next.kind === "final" ? "★" : next.number}
          </span>
          <div className="n5-next-body">
            <p className="n5-eyebrow">{progress.enrolment ? "Up next" : "Start here"}</p>
            <strong>{next.title}</strong>
            <small>
              {next.episode ? `Episode ${next.episode.number} · ${next.episode.title}` : next.kind === "final" ? "Season final" : "Study unit and checkpoint"}
            </small>
          </div>
          <button className="n5-primary" disabled={!script || !pilot || Boolean(busy)} onClick={() => open(next.lessonId)}>
            {busy === next.lessonId ? "Opening…" : progress.enrolment ? `Continue: Unit ${next.number}` : "Start Unit 1"}
          </button>
        </section>
      )}
      {!script && <p className="n5-muted n5-hint">Pick romaji or kana above to begin. One script everywhere, never mixed.</p>}
      {Boolean(error) && <Failure error={error} />}

      {active.length > 0 && (
        <p className="n5-resume-line">
          <span className="n5-muted">Unfinished:</span>
          {active.map((a) => (
            <Link key={a.id} href={`/app/n5/attempts/${a.id}`}>
              Resume unfinished {a.script} practice
              {a.lessonId ? ` · Unit ${course.units.find((u) => u.lessonId === a.lessonId)?.number ?? "?"}` : ""}
            </Link>
          ))}
        </p>
      )}

      <section className="n5-map" aria-labelledby="n5-map-title">
        <h2 id="n5-map-title" className="n5-visually-hidden">
          Units
        </h2>
        {SECTIONS.map((section) => (
          <div key={section.title} className="n5-map-row">
            <p className="n5-map-label">
              {section.title}
              <small>
                {section.range[0]}–{section.range[1]}
              </small>
            </p>
            <ol className="n5-tiles">
              {course.units
                .filter((u) => u.number >= section.range[0] && u.number <= section.range[1])
                .map((u) => {
                  const p = byLesson.get(u.lessonId);
                  const status = p?.status ?? "not_started";
                  const where = u.episode ? `Ep ${u.episode.number}` : u.kind === "final" ? "Final" : "Checkpoint";
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="n5-tile"
                        data-status={status}
                        data-next={u.lessonId === next?.lessonId || undefined}
                        data-kind={u.kind}
                        disabled={!script || Boolean(busy)}
                        onClick={() => open(u.lessonId)}
                        title={`Unit ${u.number}: ${u.title}${u.episode ? ` · Episode ${u.episode.number}: ${u.episode.title}` : ""}`}
                        aria-label={`Unit ${u.number}: ${u.title}. ${STATUS_LABEL[status]}`}
                      >
                        <span className="n5-tile-top">
                          <b>{u.kind === "final" ? "★" : String(u.number).padStart(2, "0")}</b>
                          <i aria-hidden>
                            {status === "passed" ? "✓" : p?.speaking === "demonstrated" ? "🎙" : p?.bestPercent != null ? `${Math.round(p.bestPercent)}%` : ""}
                          </i>
                        </span>
                        <span className="n5-tile-title">{u.title}</span>
                        <span className="n5-tile-where">{where}</span>
                      </button>
                    </li>
                  );
                })}
            </ol>
          </div>
        ))}
        <p className="n5-map-legend n5-muted" aria-hidden>
          <span data-key="passed">Passed</span>
          <span data-key="practised">Started</span>
          <span data-key="next">Up next</span>
        </p>
      </section>

      <footer className="n5-map-foot n5-muted">
        <p>
          Coming later:{" "}
          {planned.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              {t.title} <span className="n5-chip n5-chip-soft">Planned</span>
            </span>
          ))}
        </p>
        <p>{course.limitation}</p>
      </footer>
    </div>
  );
}
