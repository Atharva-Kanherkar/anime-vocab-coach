"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { N5Answer, N5Attempt, N5Lesson } from "../../../../shared/n5/contracts";
import { answerList, draftKey, restoreDraft, type Draft, type Snapshot } from "@/lib/n5/core";
import { CourseFailure, courseRequest, Failure, Loading, newKey, useCourse } from "./common";

export function CourseAttempt({ attemptId, ownerId }: { attemptId: string; ownerId: string }) {
  const load = useCallback(async (signal: AbortSignal) => {
    const attempt = await courseRequest<N5Attempt>(`/attempts/${attemptId}`, undefined, undefined, signal);
    if (attempt.status === "complete") return { attempt, lesson: null };
    const lesson = await courseRequest<N5Lesson>(`/lessons/${attempt.lessonId}?script=${attempt.script}`, undefined, undefined, signal);
    return { attempt, lesson };
  }, [attemptId]);
  const state = useCourse(load);
  if (state.error) return <><Failure error={state.error} /><Link href="/app/n5">Back to course</Link><button onClick={() => location.reload()}>Retry loading attempt</button></>;
  if (!state.data) return <Loading />;
  if (state.data.attempt.status === "complete") return <Results attempt={state.data.attempt} ownerId={ownerId} />;
  return <AttemptForm key={attemptId} initial={state.data.attempt} lesson={state.data.lesson!} ownerId={ownerId} />;
}
function Results({ attempt, ownerId }: { attempt: N5Attempt; ownerId: string }) {
  useEffect(() => { try { sessionStorage.removeItem(draftKey(ownerId, attempt.id)); } catch {} }, [ownerId, attempt.id]);
  const result = attempt.result;
  if (!result) return <Failure error={new CourseFailure("course_unavailable", 503)} />;
  return <><section className="n5-hero"><p className="n5-eyebrow">Episode 1 / {attempt.script} practice</p><h1>A first conversation starts here.</h1><p>Your objective practice is complete. Keep practising the introduction in your own words.</p></section><section className="n5-panel"><p className="n5-eyebrow">Server-graded objective questions</p><p className="n5-score">{result.correct}<span> / {result.total}</span></p><h2>What this result tells you</h2><dl className="n5-skills"><div><dt>Vocabulary and grammar questions</dt><dd>{result.correct} of {result.total} correct</dd></div><div><dt>{attempt.script === "romaji" ? "Romaji composition" : "Kana composition"}</dt><dd>Needs review</dd></div><div><dt>Speaking</dt><dd>Not assessed</dd></div><div><dt>Listening</dt><dd>Not assessed</dd></div><div><dt>Kanji literacy</dt><dd>Not assessed</dd></div></dl><p className="n5-muted">Course mastery is not established. This is unreviewed preview practice, not an official JLPT score or pass prediction.</p><div className="n5-actions"><Link className="n5-primary" href={`/app/n5/lessons/${attempt.lessonId}`}>Practise this introduction again</Link><Link href="/app/n5">Back to your course</Link></div></section></>;
}
function AttemptForm({ initial, lesson, ownerId }: { initial: N5Attempt; lesson: N5Lesson; ownerId: string }) {
  const router = useRouter(); const storageKey = draftKey(ownerId, initial.id);
  const [restored] = useState(() => { try { return restoreDraft(sessionStorage.getItem(storageKey), ownerId, initial, lesson.questions); } catch { return null; } });
  const alreadySaved = Boolean(restored?.pending && initial.revision === restored.pending.revision + 1 && JSON.stringify(initial.answers) === JSON.stringify(restored.pending.answers));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((alreadySaved ? initial.answers : restored?.answers ?? initial.answers).map((a) => [a.questionId, a.value])));
  const [revision, setRevision] = useState(alreadySaved ? initial.revision : restored?.revision ?? initial.revision);
  const revisionRef = useRef(revision);
  const [pending, setPending] = useState<Snapshot | null>(alreadySaved ? null : restored?.pending ?? null);
  const pendingRef = useRef(pending);
  const [error, setError] = useState<unknown>(restored && restored.revision !== initial.revision && !alreadySaved ? new CourseFailure("conflict", 409) : lesson.contentVersion !== initial.contentVersion ? new CourseFailure("stale_content", 409) : null);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [finished, setFinished] = useState<N5Attempt | null>(null);
  const abort = useRef<AbortController | null>(null);
  const answers = answerList(values, lesson.questions);
  const blocked = error instanceof CourseFailure && ["conflict", "stale_content"].includes(error.code);
  const complete = answers.length === lesson.questions.length;
  function persist(current: N5Answer[], at: number, operation: Snapshot | null) {
    const draft: Draft = { version: 1, ownerId, attemptId: initial.id, contentVersion: initial.contentVersion, script: initial.script, revision: at, answers: current, pending: operation };
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); } catch { /* explicit save still works */ }
  }
  useEffect(() => () => abort.current?.abort(), []);
  async function save(): Promise<number> {
    const snapshot = pendingRef.current ?? { revision: revisionRef.current, idempotencyKey: newKey(), answers };
    pendingRef.current = snapshot; setPending(snapshot); persist(answers, revisionRef.current, snapshot);
    const response = await courseRequest<{ revision: number }>(`/attempts/${initial.id}/answers`, snapshot, undefined, abort.current?.signal);
    revisionRef.current = response.revision; setRevision(response.revision); pendingRef.current = null; setPending(null);
    persist(answers, response.revision, null); setSaved(true);
    // A restored draft can contain later edits alongside a lost older receipt.
    if (JSON.stringify(snapshot.answers) !== JSON.stringify(answers)) return save();
    return response.revision;
  }
  async function submit(finish: boolean) {
    if (busyRef.current || blocked || !answers.length) return;
    busyRef.current = true; setBusy(true); setError(null); abort.current = new AbortController();
    try {
      const at = await save();
      if (finish) {
        const result = await courseRequest<N5Attempt>(`/attempts/${initial.id}/finish`, { revision: at }, undefined, abort.current.signal);
        if (result.status !== "complete") throw new CourseFailure("course_unavailable", 503);
        try { sessionStorage.removeItem(storageKey); } catch {} setFinished(result); router.replace(`/app/n5/results/${result.id}`);
      }
    } catch (e) {
      if (abort.current?.signal.aborted) return;
      // Semantic validation did not write; a deliberate edit must get a fresh key.
      if (e instanceof CourseFailure && e.status === 400) { pendingRef.current = null; setPending(null); persist(answers, revisionRef.current, null); }
      setError(e);
      if (e instanceof CourseFailure && e.questionId) requestAnimationFrame(() => document.getElementById(`question-${e.questionId}`)?.focus());
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function discard() {
    if (busyRef.current) return; busyRef.current = true; setBusy(true);
    try { await courseRequest(`/attempts/${initial.id}`, undefined, "DELETE"); try { sessionStorage.removeItem(storageKey); } catch {} router.replace(`/app/n5/lessons/${initial.lessonId}`); }
    catch (e) { setError(e); } finally { busyRef.current = false; setBusy(false); }
  }
  if (finished) return <Results attempt={finished} ownerId={ownerId} />;
  return <><section className="n5-hero"><p className="n5-eyebrow">Episode 1 / {initial.script} / revision {revision}</p><h1>Make the words yours.</h1><p>Answer eight questions, then introduce yourself in two short responses. Your script stays fixed for this attempt.</p></section>
    <form onSubmit={(e) => { e.preventDefault(); void submit(true); }} className="n5-quiz">
      {lesson.questions.map((q, index) => <fieldset key={q.id} className="n5-panel" disabled={busy || Boolean(pending) || blocked}><legend><span className="n5-number">{String(index + 1).padStart(2, "0")}</span> {q.prompt}</legend>
        {q.kind === "choice" ? <div className="n5-options" id={`question-${q.id}`} tabIndex={-1}>{q.choices?.map((c) => <label key={c.id}><input type="radio" name={q.id} checked={values[q.id] === c.id} onChange={() => { const next = { ...values, [q.id]: c.id }; setValues(next); setSaved(false); persist(answerList(next, lesson.questions), revisionRef.current, null); }} /><span data-owned-japanese lang={initial.script === "kana" ? "ja" : undefined}>{c.text}</span></label>)}</div>
          : <><label className="n5-muted" htmlFor={`question-${q.id}`}>{initial.script === "romaji" ? "Your romaji response" : "Your kana response"}</label><textarea id={`question-${q.id}`} name={q.id} maxLength={500} rows={3} value={values[q.id] ?? ""} spellCheck={false} lang={initial.script === "kana" ? "ja" : undefined} aria-invalid={error instanceof CourseFailure && error.questionId === q.id} onChange={(e) => { const next = { ...values, [q.id]: e.target.value }; setValues(next); setSaved(false); persist(answerList(next, lesson.questions), revisionRef.current, null); }} /></>}
      </fieldset>)}
      {Boolean(error) && <Failure error={error} />}
      <div className="n5-panel n5-actions"><button type="button" className="n5-secondary" disabled={busy || blocked || !answers.length} onClick={() => submit(false)}>{busy ? "Saving…" : pending ? "Retry saving answers" : "Save progress"}</button><button className="n5-primary" disabled={busy || blocked || !complete}>{busy ? "Please wait…" : "Finish objective practice"}</button><p role="status" className="n5-muted">{saved ? "Saved to your account." : pending ? "A save is unconfirmed. Retry the same request before editing." : "Unsaved answers stay in this tab until you save."}</p></div>
    </form>
    {blocked && <p className="n5-panel"><button className="n5-secondary" onClick={() => { try { sessionStorage.removeItem(storageKey); } catch {} location.reload(); }}>Use server answers instead of this draft</button></p>}
    <aside className="n5-panel"><h2>Speaking is not assessed</h2><p>This preview does not open your microphone. Typed responses need review, and objective answers cannot establish mastery.</p><button className="n5-danger" disabled={busy} onClick={discard}>Discard this unfinished attempt</button><p className="n5-muted">Removes only this unfinished practice and its draft. Completed results stay in your history.</p></aside>
  </>;
}
