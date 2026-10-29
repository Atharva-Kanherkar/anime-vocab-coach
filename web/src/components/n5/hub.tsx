"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  N5Catalog,
  N5Course,
  N5Enrolment,
  N5Progress,
  N5Script,
} from "../../../../shared/n5/contracts";
import { courseRequest, Failure, Loading, newKey, useCourse } from "./common";
async function load(signal: AbortSignal) {
  const catalog = await courseRequest<N5Catalog>(
    "/catalog",
    undefined,
    undefined,
    signal,
  );
  const [course, progress] = await Promise.all([
    courseRequest<N5Course>(
      `/courses/${catalog.courseId}`,
      undefined,
      undefined,
      signal,
    ),
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
function HubContent({
  catalog,
  course,
  progress,
}: Awaited<ReturnType<typeof load>>) {
  const router = useRouter();
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const [script, setScript] = useState<N5Script | null>(
    progress.enrolment?.script ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [key, setKey] = useState<string | null>(null);
  const pilot = catalog.tracks.find((t) => t.status === "unreviewed_preview");
  const active = progress.attempts
    .filter((a) => a.status === "active")
    .reverse();
  async function enrol() {
    if (!script || !pilot || lock.current) return;
    lock.current = true;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    const requestKey = key ?? newKey();
    setKey(requestKey);
    try {
      // Reconcile on this explicit action: initial progress can be stale after
      // a dropped response or an enrolment change in another tab.
      await courseRequest<N5Enrolment>(
        "/enrolments",
        { trackId: pilot.id, script, idempotencyKey: requestKey },
        undefined,
        abort.current.signal,
      );
      router.push(`/app/n5/lessons/${course.availableLessons[0]}?script=${script}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <section className="n5-hero">
        <p className="n5-eyebrow">A little Japanese, one scene at a time</p>
        <h1>Your Japanese starts here.</h1>
        <p>
          Build N5-aligned foundations through guided study with anime. Watching
          is the beginning; recall and practice make it yours.
        </p>
        <p className="n5-muted">
          Private, unreviewed pilot · One episode available · No JLPT pass or
          fluency promise
        </p>
      </section>
      {active.length > 0 && (
        <section className="n5-panel">
          <h2>Pick up where you left off</h2>
          {active.map((a) => (
            <Link
              className="n5-resume"
              key={a.id}
              href={`/app/n5/attempts/${a.id}`}
            >
              Resume unfinished {a.script} practice <span aria-hidden>→</span>
            </Link>
          ))}
        </section>
      )}
      <section className="n5-panel">
        <p className="n5-eyebrow">01 / Choose your reading style</p>
        <h2>One script. Your pace.</h2>
        <p>
          Course preferences are separate from your vocabulary deck and
          extension settings.
        </p>
        <fieldset disabled={busy} className="n5-script">
          <legend>Japanese display</legend>
          {(["romaji", "kana"] as const).map((s) => (
            <label key={s}>
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
              <small>
                {s === "romaji"
                  ? "Read with Latin letters"
                  : "Read with Japanese kana"}
              </small>
            </label>
          ))}
        </fieldset>
        {script && (
          <p
            className="n5-sample"
            data-owned-japanese
            lang={script === "kana" ? "ja" : undefined}
          >
            {script === "romaji" ? "Haru desu." : "ハルです。"}
          </p>
        )}
        {Boolean(error) && <Failure error={error} />}
        <button
          className="n5-primary"
          disabled={
            !script || !pilot || !course.availableLessons.length || busy
          }
          onClick={enrol}
        >
          {busy
            ? "Opening your lesson…"
            : progress.enrolment
              ? "Open episode 1"
              : "Start the private pilot"}
        </button>
      </section>
      <section>
        <p className="n5-eyebrow">02 / Choose your story</p>
        <h2>A familiar world to practise in.</h2>
        <div className="n5-tracks">
          {catalog.tracks.map((t, i) => (
            <article key={t.id} className="n5-panel">
              <span className="n5-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3>{t.title}</h3>
              <p>
                {t.adaptation} · Season {t.season}
              </p>
              <span className="n5-tag">
                {t.status === "planned"
                  ? "Planned · not available"
                  : "Episode 1 · unreviewed pilot"}
              </span>
            </article>
          ))}
        </div>
      </section>
      <section className="n5-panel">
        <p className="n5-eyebrow">03 / The course roadmap</p>
        <h2>24 steps toward everyday Japanese.</h2>
        <p>
          Only the first unit is available in this preview. Speaking, season
          tests and full course coverage are still being built.
        </p>
        <ol className="n5-units">
          {course.units.map((u, i) => (
            <li key={u.id}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                {u.title}
                <small>
                  {u.status === "planned" ? "Planned" : "Unreviewed pilot"}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {progress.attempts.some((a) => a.status === "complete") && (
        <section className="n5-panel">
          <h2>Your practice history</h2>
          {progress.attempts
            .filter((a) => a.status === "complete")
            .reverse()
            .slice(0, 5)
            .map((a) => (
              <p key={a.id}>
                <Link href={`/app/n5/results/${a.id}`}>
                  View {a.script} objective practice result
                </Link>
              </p>
            ))}
        </section>
      )}
    </>
  );
}
