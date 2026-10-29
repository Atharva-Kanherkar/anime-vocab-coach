"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { N5Attempt, N5Lesson } from "../../../../shared/n5/contracts";
import { answerList, draftKey } from "@/lib/n5/core";
import { locked } from "@/lib/n5/attempt-state";
import {
  CourseFailure,
  courseRequest,
  Failure,
  Loading,
  useCourse,
} from "./common";
import { useAttempt } from "./use-attempt";

export function CourseAttempt({
  attemptId,
  ownerId,
  mode = "attempt",
}: {
  attemptId: string;
  ownerId: string;
  mode?: "attempt" | "results";
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const attempt = await courseRequest<N5Attempt>(
        `/attempts/${attemptId}`,
        undefined,
        undefined,
        signal,
      );
      if (attempt.status === "complete" || mode === "results")
        return { attempt, lesson: null };
      const lesson = await courseRequest<N5Lesson>(
        `/lessons/${attempt.lessonId}?script=${attempt.script}`,
        undefined,
        undefined,
        signal,
      );
      return { attempt, lesson };
    },
    [attemptId, mode],
  );
  const state = useCourse(load);
  if (state.error) {
    return (
      <>
        <Failure error={state.error} />
        <Link href="/app/n5">Back to course</Link>
        <button onClick={() => location.reload()}>Retry loading attempt</button>
      </>
    );
  }
  if (!state.data) return <Loading />;
  const { attempt, lesson } = state.data;
  if (attempt.status === "complete")
    return <Results attempt={attempt} ownerId={ownerId} />;
  if (mode === "results") return <AttemptRedirect attemptId={attemptId} />;
  return (
    <AttemptForm
      key={attemptId}
      initial={attempt}
      lesson={lesson!}
      ownerId={ownerId}
    />
  );
}

function AttemptRedirect({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/app/n5/attempts/${attemptId}`);
  }, [attemptId, router]);
  return (
    <p role="status">
      This attempt is unfinished.{" "}
      <Link href={`/app/n5/attempts/${attemptId}`}>Resume practice</Link>.
    </p>
  );
}

function Results({
  attempt,
  ownerId,
}: {
  attempt: N5Attempt;
  ownerId: string;
}) {
  useEffect(() => {
    try {
      sessionStorage.removeItem(draftKey(ownerId, attempt.id));
    } catch {
      /* optional storage */
    }
  }, [ownerId, attempt.id]);
  const result = attempt.result;
  if (!result)
    return <Failure error={new CourseFailure("course_unavailable", 503)} />;
  return (
    <>
      <section className="n5-hero">
        <p className="n5-eyebrow">Episode 1 / {attempt.script} practice</p>
        <h1>A first conversation starts here.</h1>
        <p>
          Your objective practice is complete. Keep practising the introduction
          in your own words.
        </p>
      </section>
      <section className="n5-panel">
        <p className="n5-eyebrow">Server-graded objective questions</p>
        <p className="n5-score">
          {result.correct}
          <span> / {result.total}</span>
        </p>
        <h2>What this result tells you</h2>
        <dl className="n5-skills">
          <div>
            <dt>Vocabulary and grammar questions</dt>
            <dd>
              {result.correct} of {result.total} correct
            </dd>
          </div>
          <div>
            <dt>
              {attempt.script === "romaji"
                ? "Romaji composition"
                : "Kana composition"}
            </dt>
            <dd>Needs review</dd>
          </div>
          <div>
            <dt>Speaking</dt>
            <dd>Not assessed</dd>
          </div>
          <div>
            <dt>Listening</dt>
            <dd>Not assessed</dd>
          </div>
          <div>
            <dt>Kanji literacy</dt>
            <dd>Not assessed</dd>
          </div>
        </dl>
        <p className="n5-muted">
          Course mastery is not established. This is unreviewed preview
          practice, not an official JLPT score or pass prediction.
        </p>
        <div className="n5-actions">
          <Link
            className="n5-primary"
            href={`/app/n5/lessons/${attempt.lessonId}`}
          >
            Practise this introduction again
          </Link>
          <Link href="/app/n5">Back to your course</Link>
        </div>
      </section>
    </>
  );
}

function AttemptForm({
  initial,
  lesson,
  ownerId,
}: {
  initial: N5Attempt;
  lesson: N5Lesson;
  ownerId: string;
}) {
  const router = useRouter();
  const practice = useAttempt(initial, lesson, ownerId);
  const { state, error, busy, finished } = practice;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const values = Object.fromEntries(
    state.answers.map((a) => [a.questionId, a.value]),
  );
  const readOnly = busy || locked(state);
  const complete = state.answers.length === lesson.questions.length;
  useEffect(() => {
    if (finished) router.replace(`/app/n5/results/${finished.id}`);
  }, [finished, router]);
  function edit(id: string, value: string) {
    practice.edit(answerList({ ...values, [id]: value }, lesson.questions));
  }
  if (finished) return <Results attempt={finished} ownerId={ownerId} />;
  return (
    <>
      <section className="n5-hero">
        <p className="n5-eyebrow">
          Episode 1 / {initial.script} / revision {state.revision}
        </p>
        <h1>Make the words yours.</h1>
        <p>
          Answer eight questions, then introduce yourself in two short
          responses. Your script stays fixed for this attempt.
        </p>
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void practice.submit(true);
        }}
        className="n5-quiz"
      >
        {lesson.questions.map((question, index) => (
          <fieldset key={question.id} className="n5-panel">
            <legend>
              <span className="n5-number">
                {String(index + 1).padStart(2, "0")}
              </span>{" "}
              {question.prompt}
            </legend>
            {question.kind === "choice" ? (
              <div
                className="n5-options"
                id={`question-${question.id}`}
                tabIndex={-1}
              >
                {question.choices?.map((choice) => (
                  <label key={choice.id}>
                    <input
                      type="radio"
                      name={question.id}
                      disabled={readOnly}
                      checked={values[question.id] === choice.id}
                      onChange={() => edit(question.id, choice.id)}
                    />
                    <span
                      data-owned-japanese
                      lang={initial.script === "kana" ? "ja" : undefined}
                    >
                      {choice.text}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <>
                <label className="n5-muted" htmlFor={`question-${question.id}`}>
                  {initial.script === "romaji"
                    ? "Your romaji response"
                    : "Your kana response"}
                </label>
                <textarea
                  id={`question-${question.id}`}
                  name={question.id}
                  maxLength={500}
                  rows={3}
                  value={values[question.id] ?? ""}
                  readOnly={readOnly}
                  spellCheck={false}
                  lang={initial.script === "kana" ? "ja" : undefined}
                  aria-invalid={
                    error instanceof CourseFailure &&
                    error.questionId === question.id
                  }
                  onChange={(event) => edit(question.id, event.target.value)}
                />
              </>
            )}
          </fieldset>
        ))}
        {Boolean(error) && <Failure error={error} />}
        <div className="n5-panel n5-actions">
          <button
            type="button"
            className="n5-secondary"
            disabled={
              busy ||
              Boolean(state.blocked) ||
              state.finishRevision !== null ||
              !state.answers.length
            }
            onClick={() => practice.submit(false)}
          >
            {busy
              ? "Saving…"
              : state.pending
                ? "Retry saving answers"
                : "Save progress"}
          </button>
          <button
            className="n5-primary"
            disabled={busy || Boolean(state.blocked) || !complete}
          >
            {busy
              ? "Please wait…"
              : state.finishRevision !== null
                ? "Retry finishing practice"
                : "Finish objective practice"}
          </button>
          <p role="status" className="n5-muted">
            {state.finishRevision !== null
              ? "Finishing is unconfirmed. Retry to retrieve your result."
              : state.pending
                ? "A save is unconfirmed. Retry the same request before editing."
                : practice.saved
                  ? "Saved to your account."
                  : "Unsaved answers stay in this tab until you save."}
          </p>
        </div>
      </form>
      {state.blocked && (
        <p className="n5-panel">
          <button className="n5-secondary" onClick={practice.reloadServer}>
            Use server answers instead of this draft
          </button>
        </p>
      )}
      <aside className="n5-panel">
        <h2>Speaking is not assessed</h2>
        <p>
          This preview does not open your microphone. Typed responses need
          review, and objective answers cannot establish mastery.
        </p>
        {confirmDiscard ? (
          <div
            role="alertdialog"
            aria-labelledby="discard-title"
            aria-describedby="discard-description"
          >
            <h3 id="discard-title">Discard this attempt?</h3>
            <p id="discard-description">
              This deletes its saved answers and local draft. Copy any text you
              want to keep first.
            </p>
            <div className="n5-actions">
              <button
                className="n5-danger"
                disabled={busy}
                onClick={async () => {
                  if (await practice.discard())
                    router.replace(`/app/n5/lessons/${initial.lessonId}`);
                }}
              >
                Confirm discard
              </button>
              <button disabled={busy} onClick={() => setConfirmDiscard(false)}>
                Keep this attempt
              </button>
            </div>
          </div>
        ) : (
          <button
            className="n5-danger"
            disabled={busy}
            onClick={() => setConfirmDiscard(true)}
          >
            Discard this unfinished attempt
          </button>
        )}
        <p className="n5-muted">
          Removes only this unfinished practice and its draft. Completed results
          stay in your history.
        </p>
      </aside>
    </>
  );
}
