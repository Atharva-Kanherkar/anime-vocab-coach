"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  N5Attempt,
  N5Lesson,
  N5Progress,
  N5Script,
} from "../../../../shared/n5/contracts";
import { safeLink } from "@/lib/n5/core";
import { CourseFailure, courseRequest, Failure, Loading, newKey, useCourse } from "./common";
export function CourseLesson({
  lessonId,
  ownerId,
  script,
}: {
  lessonId: string;
  ownerId: string;
  script?: N5Script;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [lesson, progress] = await Promise.all([
        courseRequest<N5Lesson>(
          `/lessons/${lessonId}${script ? `?script=${script}` : ""}`,
          undefined,
          undefined,
          signal,
        ),
        courseRequest<N5Progress>("/me/progress", undefined, undefined, signal),
      ]);
      const attempts = await Promise.allSettled(
        progress.attempts
          .filter((attempt) => attempt.status === "active")
          .map((attempt) =>
            courseRequest<N5Attempt>(
              `/attempts/${attempt.id}`,
              undefined,
              undefined,
              signal,
            ),
          ),
      );
      return {
        lesson,
        active: attempts.flatMap((result) =>
          result.status === "fulfilled" &&
          result.value.lessonId === lesson.id &&
          result.value.contentVersion === lesson.contentVersion
            ? [result.value]
            : [],
        ),
        watched: progress.observations.some(
          (e) =>
            e.episodeId === lesson.episodeId && e.kind === "watch_complete",
        ),
      };
    },
    [lessonId, script],
  );
  const state = useCourse(load);
  if (state.error)
    return (
      <>
        <Failure error={state.error} />
        <Link href="/app/n5">Choose your course script</Link>
      </>
    );
  if (!state.data) return <Loading />;
  return <LessonContent ownerId={ownerId} {...state.data} />;
}
function LessonContent({
  lesson,
  watched: initialWatched,
  ownerId,
  active,
}: {
  lesson: N5Lesson;
  watched: boolean;
  ownerId: string;
  active: N5Attempt[];
}) {
  const router = useRouter();
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const [watched, setWatched] = useState(initialWatched);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const memoryKeys = useRef<Record<string, string>>({});
  function operationKey(kind: string) {
    const storageKey = `avc:n5:op:${ownerId}:${lesson.id}:${lesson.contentVersion}:${lesson.script}:${kind}`;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && /^[a-zA-Z0-9_-]{1,100}$/.test(stored))
        return { storageKey, key: stored };
    } catch {
      /* optional storage */
    }
    const key = memoryKeys.current[kind] ?? newKey();
    memoryKeys.current[kind] = key;
    try {
      sessionStorage.setItem(storageKey, key);
    } catch {
      /* optional storage */
    }
    return { storageKey, key };
  }
  async function act(kind: "watch" | "start") {
    if (lock.current) return;
    lock.current = true;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    const op = operationKey(kind);
    try {
      if (kind === "watch") {
        await courseRequest(
          "/events",
          {
            episodeId: lesson.episodeId,
            kind: "watch_complete",
            idempotencyKey: op.key,
          },
          undefined,
          abort.current.signal,
        );
        setWatched(true);
      } else {
        const attempt = await courseRequest<N5Attempt>(
          "/attempts",
          {
            lessonId: lesson.id,
            contentVersion: lesson.contentVersion,
            script: lesson.script,
            idempotencyKey: op.key,
          },
          undefined,
          abort.current.signal,
        );
        try {
          sessionStorage.removeItem(op.storageKey);
        } catch {}
        delete memoryKeys.current[kind];
        router.push(`/app/n5/attempts/${attempt.id}`);
      }
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const watchUrl = safeLink(lesson.watchLinks[0]?.url ?? "", "watch");
  const source = safeLink(lesson.summarySource, "source");
  return (
    <>
      <section className="n5-hero">
        <p className="n5-eyebrow">
          Your Lie in April / Episode 1 · {lesson.script}
        </p>
        <h1>Meet someone new.</h1>
        <p>{lesson.canDo}</p>
        <span className="n5-tag">Original, unreviewed teaching material</span>
      </section>
      <section className="n5-panel">
        <h2>Before you watch</h2>
        <p>
          Practise introducing yourself to a new classmate. The episode is your
          setting; the examples below are original teaching sentences, not show
          dialogue.
        </p>
        <div className="n5-words">
          {lesson.vocabulary.map((v) => (
            <div key={v.id}>
              <strong
                data-owned-japanese
                lang={lesson.script === "kana" ? "ja" : undefined}
              >
                {v.reading}
              </strong>
              <span>{v.meaning}</span>
            </div>
          ))}
        </div>
        {lesson.grammar.map((g) => (
          <div key={g.id} className="n5-example">
            <p>{g.explanation}</p>
            <strong
              data-owned-japanese
              lang={lesson.script === "kana" ? "ja" : undefined}
            >
              {g.example}
            </strong>
          </div>
        ))}
      </section>
      <section className="n5-panel">
        <p className="n5-eyebrow">Watch in your own time</p>
        <h2>A new encounter.</h2>
        <p>
          Watch through your own streaming subscription. Check availability in
          your region; this link opens the series, not a verified episode.
        </p>
        {watchUrl && (
          <a
            className="n5-secondary"
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Crunchyroll series
          </a>
        )}
        <p className="n5-muted">
          You can watch elsewhere or without the extension. We do not verify
          playback.
        </p>
        {!watched && (
          <button
            className="n5-primary"
            disabled={busy}
            onClick={() => act("watch")}
          >
            {busy ? "Saving…" : "I watched episode 1"}
          </button>
        )}
        {active.length > 0 && (
          <section aria-label="Unfinished practice">
            <h3>Pick up your practice</h3>
            {active.map((attempt) => (
              <p key={attempt.id}>
                <Link
                  className="n5-primary"
                  href={`/app/n5/attempts/${attempt.id}`}
                >
                  Resume unfinished {attempt.script} practice
                </Link>
              </p>
            ))}
            <p className="n5-muted">
              Starting another practice creates a separate attempt. You can keep
              up to five unfinished attempts.
            </p>
          </section>
        )}
        {watched && (
          <div className="n5-recap">
            <p className="n5-eyebrow">Episode recap</p>
            <p>{lesson.summary}</p>
            {source && (
              <a href={source} target="_blank" rel="noopener noreferrer">
                Episode facts source
              </a>
            )}
            <p className="n5-muted">
              Watched is an observation, not proof of language proficiency.
            </p>
          </div>
        )}
        {Boolean(error) && <Failure error={error} />}
        {error instanceof CourseFailure && error.code === "enrolment_changed" && (
          <button className="n5-secondary" onClick={() => location.assign(`/app/n5/lessons/${lesson.id}`)}>
            Reload lesson
          </button>
        )}
        {watched && (
          <button
            className="n5-primary"
            disabled={busy}
            onClick={() => act("start")}
          >
            {busy
              ? "Opening practice…"
              : active.length
                ? "Start another practice"
                : "Begin episode practice"}
          </button>
        )}
      </section>
      <aside className="n5-panel">
        <h2>Speaking comes next</h2>
        <p>
          Conversation assessment is unavailable in this preview. No microphone
          will open, and this practice cannot establish speaking or course
          mastery.
        </p>
        <Link href="/app/n5">Back to your course</Link>
      </aside>
    </>
  );
}
