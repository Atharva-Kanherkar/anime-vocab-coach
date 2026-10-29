"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { N5Attempt, N5Feedback, N5Lesson, N5Question, N5Skill } from "../../../../shared/n5/contracts";
import { answerList, draftKey } from "@/lib/n5/core";
import { locked } from "@/lib/n5/attempt-state";
import { CourseFailure, courseRequest, Failure, Loading, useCourse } from "./common";
import { useAttempt } from "./use-attempt";
import { PlayButton } from "./audio";
import { KeyChoices } from "./lesson";

export function CourseAttempt({ attemptId, ownerId, mode = "attempt" }: { attemptId: string; ownerId: string; mode?: "attempt" | "results" }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const attempt = await courseRequest<N5Attempt>(`/attempts/${attemptId}`, undefined, undefined, signal);
      if (mode === "results" && attempt.status !== "complete") return { attempt, lesson: null };
      // Results need the lesson for prompts and choice text; a retired lesson degrades to the score only.
      const lesson = await courseRequest<N5Lesson>(`/lessons/${attempt.lessonId}?script=${attempt.script}`, undefined, undefined, signal).catch((error) => {
        if (attempt.status === "complete") return null;
        throw error;
      });
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
  if (attempt.status === "complete") return <Results attempt={attempt} lesson={lesson} ownerId={ownerId} />;
  if (mode === "results") return <AttemptRedirect attemptId={attemptId} />;
  return <AttemptForm key={attemptId} initial={attempt} lesson={lesson!} ownerId={ownerId} />;
}

function AttemptRedirect({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/app/n5/attempts/${attemptId}`);
  }, [attemptId, router]);
  return (
    <p role="status">
      This attempt is unfinished. <Link href={`/app/n5/attempts/${attemptId}`}>Resume practice</Link>.
    </p>
  );
}

const SKILLS: { id: N5Skill; label: string }[] = [
  { id: "vocabulary", label: "Vocabulary" },
  { id: "grammar", label: "Grammar" },
  { id: "reading", label: "Reading" },
  { id: "listening", label: "Listening" },
];

function Results({ attempt, lesson, ownerId }: { attempt: N5Attempt; lesson: N5Lesson | null; ownerId: string }) {
  useEffect(() => {
    try {
      sessionStorage.removeItem(draftKey(ownerId, attempt.id));
    } catch {
      /* optional storage */
    }
  }, [ownerId, attempt.id]);
  const result = attempt.result;
  if (!result) return <Failure error={new CourseFailure("course_unavailable", 503)} />;
  const ja = attempt.script === "kana" ? "ja" : undefined;
  const percent = Math.round(result.objectivePercent);
  return (
    <>
      <section className="n5-hero n5-results-hero">
        <div>
          <p className="n5-eyebrow">
            Unit {lesson?.unit ?? ""} · {attempt.script} practice
          </p>
          <h1>{result.passed ? "Unit passed." : "Good practice. Let's close the gaps."}</h1>
          <p className="n5-lead">
            {result.passed
              ? "You cleared the 80% gate. Speak with Haru to lock it in, then move on."
              : "Review the misses below, drill the words, then try again. 80% passes."}
          </p>
        </div>
        <div className="n5-ring" data-passed={result.passed || undefined} style={{ ["--n5-progress" as string]: `${result.objectivePercent * 3.6}deg` }}>
          <strong className="n5-score">
            {result.correct}
            <span> / {result.total}</span>
          </strong>
          <span>{percent}%</span>
        </div>
      </section>
      <section className="n5-panel">
        <h2>Skills</h2>
        <dl className="n5-skill-bars">
          {SKILLS.filter((s) => result.skills?.[s.id]?.total).map((s) => {
            const skill = result.skills[s.id];
            return (
              <div key={s.id}>
                <dt>{s.label}</dt>
                <dd>
                  <span className="n5-bar" aria-hidden>
                    <span style={{ width: `${(skill.correct / skill.total) * 100}%` }} />
                  </span>
                  {skill.correct} of {skill.total}
                </dd>
              </div>
            );
          })}
          <div>
            <dt>{attempt.script === "romaji" ? "Romaji writing" : "Kana writing"}</dt>
            <dd>See feedback below</dd>
          </div>
          <div>
            <dt>Speaking</dt>
            <dd>Practised separately with Haru</dd>
          </div>
          <div>
            <dt>Kanji</dt>
            <dd>Not covered in this course</dd>
          </div>
        </dl>
        <p className="n5-muted">Practice evidence from an unreviewed course, not a JLPT score or pass prediction. Mastery is not claimed.</p>
        <div className="n5-actions">
          {lesson?.nextLessonId && result.passed && (
            <Link className="n5-primary" href={`/app/n5/lessons/${lesson.nextLessonId}`}>
              Next unit →
            </Link>
          )}
          <Link className={result.passed ? "n5-secondary" : "n5-primary"} href={`/app/n5/speak/${attempt.lessonId}`}>
            Speak with Haru
          </Link>
          <Link className="n5-secondary" href={`/app/n5/lessons/${attempt.lessonId}${result.passed ? "" : "#drill"}`}>
            {result.passed ? "Back to unit" : "Drill and try again"}
          </Link>
          <Link href="/app/n5">Course map</Link>
        </div>
      </section>
      {lesson && <TypedFeedback attempt={attempt} lesson={lesson} />}
      {lesson && attempt.review && (
        <section className="n5-panel">
          <h2>Answer review</h2>
          <ol className="n5-review">
            {attempt.review
              .filter((item) => item.correct !== null)
              .map((item) => {
                const question = lesson.questions.find((q) => q.id === item.questionId);
                if (!question) return null;
                const choice = (id: string | null | undefined) => question.choices?.find((c) => c.id === id)?.text;
                const japanese = question.choiceLanguage === "ja";
                return (
                  <li key={item.questionId} data-correct={item.correct || undefined}>
                    <p className="n5-review-head">
                      <span aria-hidden>{item.correct ? "✓" : "✗"}</span>
                      <span className="n5-visually-hidden">{item.correct ? "Correct." : "Incorrect."}</span> {question.prompt}
                    </p>
                    {question.text && (
                      <p className="n5-ja-line" data-owned-japanese lang={ja}>
                        {question.text}
                      </p>
                    )}
                    {item.transcript && (
                      <p className="n5-transcript">
                        {question.audio && <PlayButton path={`/audio/${question.audio}`} label="the recording" compact slow={false} />}
                        <span data-owned-japanese lang={ja}>
                          {item.transcript}
                        </span>
                      </p>
                    )}
                    {!item.correct && (
                      <p>
                        Your answer:{" "}
                        <span data-owned-japanese={japanese || undefined} lang={japanese ? ja : undefined}>
                          {choice(item.answer) ?? "—"}
                        </span>
                      </p>
                    )}
                    <p>
                      Answer:{" "}
                      <strong data-owned-japanese={japanese || undefined} lang={japanese ? ja : undefined}>
                        {choice(item.correctChoiceId)}
                      </strong>
                    </p>
                    {item.explanation && <p className="n5-muted">{item.explanation}</p>}
                  </li>
                );
              })}
          </ol>
        </section>
      )}
    </>
  );
}

function TypedFeedback({ attempt, lesson }: { attempt: N5Attempt; lesson: N5Lesson }) {
  const [feedback, setFeedback] = useState<N5Feedback | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(true);
  const ja = attempt.script === "kana" ? "ja" : undefined;
  const run = useCallback(
    () =>
      courseRequest<N5Feedback>(`/attempts/${attempt.id}/feedback`, {})
        .then((next) => {
          setFeedback(next);
          setError(null);
        })
        .catch((e) => setError(e))
        .finally(() => setBusy(false)),
    [attempt.id],
  );
  useEffect(() => {
    void run();
  }, [run]);
  function request() {
    setBusy(true);
    setError(null);
    void run();
  }
  const typed = lesson.questions.filter((q) => q.kind === "production");
  return (
    <section className="n5-panel" aria-busy={busy}>
      <p className="n5-eyebrow">Writing feedback</p>
      <h2>Your {attempt.script} answers</h2>
      {busy && !feedback && <p role="status">Checking your answers…</p>}
      {Boolean(error) && <Failure error={error} />}
      {(error || feedback?.source === "fallback") && (
        <button type="button" className="n5-secondary" disabled={busy} onClick={request}>
          {busy ? "Checking…" : "Try AI feedback again"}
        </button>
      )}
      <ol className="n5-review">
        {typed.map((question) => {
          const item = feedback?.items.find((i) => i.questionId === question.id);
          const review = attempt.review?.find((r) => r.questionId === question.id);
          return (
            <li key={question.id} data-verdict={item?.verdict}>
              <p className="n5-review-head">{question.prompt}</p>
              <p>
                You wrote:{" "}
                <span data-owned-japanese lang={ja}>
                  {review?.answer ?? attempt.answers.find((a) => a.questionId === question.id)?.value}
                </span>
              </p>
              {item && (
                <>
                  <p>
                    <span className="n5-chip" data-verdict={item.verdict}>
                      {item.verdict === "correct" ? "Correct" : item.verdict === "close" ? "Almost" : item.verdict === "retry" ? "Try again" : "Not checked"}
                    </span>{" "}
                    {item.note}
                  </p>
                  {item.correction && (
                    <p>
                      Better:{" "}
                      <strong data-owned-japanese lang={ja}>
                        {item.correction}
                      </strong>
                    </p>
                  )}
                </>
              )}
              {(item?.references ?? review?.references ?? []).length > 0 && (
                <p className="n5-muted">
                  Model answer{(item?.references ?? review?.references ?? []).length > 1 ? "s" : ""}:{" "}
                  {(item?.references ?? review?.references ?? []).map((r, i) => (
                    <span key={r}>
                      {i > 0 && " · "}
                      <span data-owned-japanese lang={ja}>
                        {r}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {feedback?.source === "ai" && <p className="n5-muted">AI feedback can be wrong. Model answers are the reference.</p>}
    </section>
  );
}

function QuestionView({
  question,
  value,
  readOnly,
  script,
  invalid,
  onChange,
}: {
  question: N5Question;
  value: string | undefined;
  readOnly: boolean;
  script: N5Attempt["script"];
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const ja = script === "kana" ? "ja" : undefined;
  const japaneseChoices = question.choiceLanguage !== "en";
  const kana = script === "kana";
  return (
    <fieldset className="n5-question">
      <legend>{question.prompt}</legend>
      {question.text && (
        <p className="n5-ja-line" data-owned-japanese lang={ja}>
          {question.text}
        </p>
      )}
      {question.audio && (
        <div className="n5-listen">
          <PlayButton path={`/audio/${question.audio}`} label="the recording" />
          <span className="n5-muted">Play as often as you like. The transcript appears after you finish.</span>
        </div>
      )}
      {question.kind === "choice" ? (
        <div className="n5-choices" id={`question-${question.id}`} tabIndex={-1} role="radiogroup" aria-label={question.prompt}>
          {question.choices?.map((choice, i) => (
            <label key={choice.id} className="n5-choice" data-selected={value === choice.id || undefined}>
              <input type="radio" name={question.id} disabled={readOnly} checked={value === choice.id} onChange={() => onChange(choice.id)} />
              <kbd aria-hidden>{i + 1}</kbd>
              <span data-owned-japanese={japaneseChoices || undefined} lang={japaneseChoices ? ja : undefined}>
                {choice.text}
              </span>
            </label>
          ))}
          <KeyChoices count={question.choices?.length ?? 0} disabled={readOnly} onPick={(i) => question.choices && onChange(question.choices[i].id)} />
        </div>
      ) : (
        <>
          <label className="n5-muted" htmlFor={`question-${question.id}`}>
            {kana ? "Your kana answer (use a Japanese keyboard/IME)" : "Your romaji answer"}
          </label>
          <textarea
            id={`question-${question.id}`}
            name={question.id}
            maxLength={500}
            rows={3}
            value={value ?? ""}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            lang={ja}
            aria-invalid={invalid}
            onChange={(event) => onChange(event.target.value)}
          />
        </>
      )}
    </fieldset>
  );
}

function AttemptForm({ initial, lesson, ownerId }: { initial: N5Attempt; lesson: N5Lesson; ownerId: string }) {
  const router = useRouter();
  const practice = useAttempt(initial, lesson, ownerId);
  const { state, error, busy, finished } = practice;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const values = Object.fromEntries(state.answers.map((a) => [a.questionId, a.value]));
  const readOnly = busy || locked(state);
  const total = lesson.questions.length;
  const answered = state.answers.length;
  const complete = answered === total;
  const firstOpen = lesson.questions.findIndex((q) => !values[q.id]);
  const [index, setIndex] = useState(() => (firstOpen === -1 ? total : firstOpen));
  const reviewing = index >= total;
  const question = lesson.questions[Math.min(index, total - 1)];
  useEffect(() => {
    if (finished) router.replace(`/app/n5/results/${finished.id}`);
  }, [finished, router]);
  // Jump to a question the server rejected (adjusting state during render, not in an effect).
  const [seenError, setSeenError] = useState(error);
  if (error !== seenError) {
    setSeenError(error);
    if (error instanceof CourseFailure && error.questionId) {
      const target = lesson.questions.findIndex((q) => q.id === error.questionId);
      if (target >= 0) setIndex(target);
    }
  }
  function edit(id: string, value: string) {
    practice.edit(answerList({ ...values, [id]: value }, lesson.questions));
  }
  function move(next: number) {
    const target = Math.max(0, Math.min(total, next));
    // Saving locks edits until acknowledged, so save only on the review screen, which has no inputs.
    if (target === total && answered > 0 && !practice.saved && !state.pending && !state.blocked && !busy) void practice.submit(false);
    setIndex(target);
  }
  if (finished) return <Loading />;
  return (
    <>
      <section className="n5-hero n5-quiz-hero">
        <p className="n5-eyebrow">
          Unit {lesson.unit} practice · {initial.script}
        </p>
        <h1>{lesson.title}</h1>
        <div className="n5-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-label={`${answered} of ${total} answered`}>
          <span style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </section>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reviewing) void practice.submit(true);
          else move(index + 1);
        }}
        className="n5-quiz"
      >
        <nav className="n5-qnav" aria-label="Questions">
          {lesson.questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              aria-current={i === index ? "step" : undefined}
              data-answered={values[q.id] ? true : undefined}
              onClick={() => move(i)}
              aria-label={`Question ${i + 1}${values[q.id] ? ", answered" : ""}`}
            >
              {i + 1}
            </button>
          ))}
          <button type="button" aria-current={reviewing ? "step" : undefined} onClick={() => move(total)}>
            ✓
          </button>
        </nav>
        {!reviewing ? (
          <div className="n5-panel">
            <p className="n5-eyebrow">
              Question {index + 1} of {total} · {question.skill}
            </p>
            <QuestionView
              key={question.id}
              question={question}
              value={values[question.id]}
              readOnly={readOnly}
              script={initial.script}
              invalid={error instanceof CourseFailure && error.questionId === question.id}
              onChange={(value) => edit(question.id, value)}
            />
            <div className="n5-actions">
              <button type="button" disabled={index === 0} onClick={() => move(index - 1)}>
                ← Back
              </button>
              <button className="n5-primary" type="submit">
                {index === total - 1 ? "Review answers →" : values[question.id] ? "Next →" : "Skip for now →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="n5-panel">
            <h2>{complete ? "Ready to finish?" : `${total - answered} question${total - answered === 1 ? "" : "s"} left`}</h2>
            {!complete && (
              <p>
                Answer every question to finish.{" "}
                <button type="button" className="n5-link" onClick={() => move(firstOpen)}>
                  Go to question {firstOpen + 1}
                </button>
              </p>
            )}
            <div className="n5-actions">
              <button
                type="button"
                className="n5-secondary"
                disabled={busy || Boolean(state.blocked) || state.finishRevision !== null || !state.answers.length}
                onClick={() => practice.submit(false)}
              >
                {busy ? "Saving…" : state.pending ? "Retry saving answers" : "Save progress"}
              </button>
              <button className="n5-primary n5-big" disabled={busy || Boolean(state.blocked) || !complete}>
                {busy ? "Please wait…" : state.finishRevision !== null ? "Retry finishing practice" : "Finish and see results"}
              </button>
            </div>
          </div>
        )}
        {Boolean(error) && <Failure error={error} />}
        <p role="status" className="n5-muted">
          {state.finishRevision !== null
            ? "Finishing is unconfirmed. Retry to retrieve your result."
            : state.pending
              ? "A save is unconfirmed. Retry the same request before editing."
              : practice.saved
                ? "Saved to your account."
                : "Answers are kept in this tab and saved when you reach the review screen."}
        </p>
      </form>
      {state.blocked && (
        <p className="n5-panel">
          <button className="n5-secondary" onClick={practice.reloadServer}>
            Use server answers instead of this draft
          </button>
        </p>
      )}
      <details className="n5-panel n5-discard">
        <summary>Discard this attempt</summary>
        {confirmDiscard ? (
          <div role="alertdialog" aria-labelledby="discard-title" aria-describedby="discard-description">
            <h3 id="discard-title">Discard this attempt?</h3>
            <p id="discard-description">This deletes its saved answers and local draft. Copy any text you want to keep first.</p>
            <div className="n5-actions">
              <button
                className="n5-danger"
                disabled={busy}
                onClick={async () => {
                  if (await practice.discard()) router.replace(`/app/n5/lessons/${initial.lessonId}`);
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
          <button className="n5-danger" disabled={busy} onClick={() => setConfirmDiscard(true)}>
            Discard this unfinished attempt
          </button>
        )}
        <p className="n5-muted">Removes only this unfinished practice and its draft. Completed results stay in your history.</p>
      </details>
    </>
  );
}
