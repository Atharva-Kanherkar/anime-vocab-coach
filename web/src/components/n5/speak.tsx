"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import type { N5Conversation, N5Lesson } from "../../../../shared/n5/contracts";
import { MAX_RECORDING_MS, recorderTransition, recordingType, remaining } from "@/lib/n5/recorder";
import { CourseFailure, courseRequest, Failure, Loading, newKey, useCourse } from "./common";
import { PlayButton, playAudio, stopAudio } from "./audio";
import { PlayerShell } from "./player";

type TurnBody = { afterSeq: number; idempotencyKey: string } & ({ text: string } | { audio: { data: string; mime: string } });

const startKey = (ownerId: string, lessonId: string) => `avc:n5:talk:${ownerId}:${lessonId}`;
function storedKey(ownerId: string, lessonId: string): string {
  try {
    const stored = sessionStorage.getItem(startKey(ownerId, lessonId));
    if (stored && /^[a-zA-Z0-9_-]{1,100}$/.test(stored)) return stored;
    const key = newKey();
    sessionStorage.setItem(startKey(ownerId, lessonId), key);
    return key;
  } catch {
    return newKey();
  }
}

export function CourseSpeak({ lessonId, ownerId }: { lessonId: string; ownerId: string }) {
  const load = useCallback(
    async (signal: AbortSignal) => courseRequest<N5Lesson>(`/lessons/${lessonId}`, undefined, undefined, signal),
    [lessonId],
  );
  const state = useCourse(load);
  if (state.error)
    return (
      <>
        <Failure error={state.error} />
        <Link href="/app/n5">Back to your course</Link>
      </>
    );
  if (!state.data) return <Loading />;
  return <Speak lesson={state.data} ownerId={ownerId} />;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function Speak({ lesson, ownerId }: { lesson: N5Lesson; ownerId: string }) {
  const [conversation, setConversation] = useState<N5Conversation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TurnBody | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showEnglish, setShowEnglish] = useState(false);
  const [recorder, dispatch] = useReducer(recorderTransition, { phase: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const media = useRef<{ recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const spoken = useRef(new Set<number>());
  const ja = lesson.script === "kana" ? "ja" : undefined;
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  useEffect(() => () => {
    media.current?.stream.getTracks().forEach((t) => t.stop());
    stopAudio();
  }, []);
  useEffect(() => {
    if (recorder.phase !== "recording") return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [recorder.phase]);

  /** Speak each new tutor turn once, after the learner has interacted with the page. */
  const speakNew = useCallback((next: N5Conversation) => {
    const latest = [...next.turns].reverse().find((t) => t.role === "tutor" && t.audio);
    if (!latest || spoken.current.has(latest.seq)) return;
    spoken.current.add(latest.seq);
    playAudio(`/conversations/${next.id}/turns/${latest.seq}/audio`).catch(() => {});
  }, []);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const started = await courseRequest<N5Conversation>("/conversations", { lessonId: lesson.id, idempotencyKey: storedKey(ownerId, lesson.id) });
      for (const t of started.turns.slice(0, -1)) spoken.current.add(t.seq);
      setConversation(started);
      if (started.status === "active") speakNew(started);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function send(body: TurnBody) {
    if (!conversation) return;
    setBusy(true);
    setError(null);
    setPending(body);
    try {
      const next = await courseRequest<N5Conversation>(`/conversations/${conversation.id}/turns`, body);
      setPending(null);
      setConversation(next);
      setDraft("");
      speakNew(next);
      dispatch({ type: "sent" });
    } catch (e) {
      // Keep the same key so a retry after a lost response can't double-post.
      if (e instanceof CourseFailure && e.status < 500 && e.status !== 408 && e.status !== 429) setPending(null);
      if (e instanceof CourseFailure && e.code === "conflict") {
        try {
          setConversation(await courseRequest<N5Conversation>(`/conversations/${conversation.id}`));
        } catch {
          /* show the original error */
        }
      }
      setError(e);
      dispatch({ type: "failed" });
    } finally {
      setBusy(false);
    }
  }

  const lastSeq = conversation?.turns[conversation.turns.length - 1]?.seq ?? 0;
  const learnerTurns = conversation?.turns.filter((t) => t.role === "learner").length ?? 0;
  const limitReached = conversation ? learnerTurns >= conversation.maxLearnerTurns : false;

  async function startRecording() {
    if (!supported) {
      dispatch({ type: "unsupported" });
      setTyping(true);
      return;
    }
    stopAudio();
    dispatch({ type: "request" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, preferred ? { mimeType: preferred, audioBitsPerSecond: 32_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
      const timer = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
      media.current = { recorder: rec, stream, chunks, timer };
      dispatch({ type: "granted", at: Date.now() });
    } catch {
      dispatch({ type: "denied" });
      setTyping(true);
    }
  }

  function stopRecording() {
    const current = media.current;
    if (!current) return;
    media.current = null;
    clearTimeout(current.timer);
    const at = Date.now();
    current.recorder.onstop = async () => {
      current.stream.getTracks().forEach((t) => t.stop());
      const type = recordingType(current.recorder.mimeType || current.chunks[0]?.type || "");
      const blob = new Blob(current.chunks, { type: current.recorder.mimeType });
      if (!type || blob.size < 200) {
        dispatch({ type: "failed" });
        return;
      }
      await send({ afterSeq: lastSeq, idempotencyKey: newKey(), audio: { data: await toBase64(blob), mime: type } });
    };
    dispatch({ type: "stop", at });
    if (current.recorder.state !== "inactive") current.recorder.stop();
  }

  async function finish() {
    if (!conversation) return;
    setBusy(true);
    setError(null);
    try {
      const done = await courseRequest<N5Conversation>(`/conversations/${conversation.id}/finish`, {});
      setConversation(done);
      try {
        sessionStorage.removeItem(startKey(ownerId, lesson.id));
      } catch {
        /* optional storage */
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    if (!conversation) return;
    setBusy(true);
    try {
      if (conversation.status === "active") await courseRequest(`/conversations/${conversation.id}`, undefined, "DELETE");
      try {
        sessionStorage.removeItem(startKey(ownerId, lesson.id));
      } catch {
        /* optional storage */
      }
      spoken.current.clear();
      setConversation(null);
      setPending(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const result = conversation?.result;
  return (
    <PlayerShell ownerId={ownerId} lessonId={lesson.id} step="speak">
      <section className="n5-hero">
        <p className="n5-eyebrow">
          Unit {lesson.unit} · Speak with Haru · {lesson.script}
        </p>
        <h1>{lesson.speaking.goal}</h1>
        <ul className="n5-goals">
          {lesson.speaking.prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      {!conversation ? (
        <section className="n5-panel n5-speak-start">
          <p>
            Haru is an AI conversation partner. Your recording is transcribed to keep the conversation going, then discarded; only the text is saved to your course history.
          </p>
          {Boolean(error) && <Failure error={error} />}
          <button className="n5-primary n5-big" disabled={busy} onClick={begin}>
            {busy ? "Connecting…" : "Start conversation"}
          </button>
          <p className="n5-muted">
            <Link href={`/app/n5/lessons/${lesson.id}`}>Back to the unit</Link>
          </p>
        </section>
      ) : (
        <section className="n5-panel n5-chat-panel">
          <div className="n5-row">
            <h2>Conversation</h2>
            <span className="n5-actions">
              <span className="n5-muted">
                {learnerTurns} / {conversation.maxLearnerTurns} replies
              </span>
              <button type="button" aria-pressed={showEnglish} onClick={() => setShowEnglish((v) => !v)}>
                {showEnglish ? "Hide English" : "Show English"}
              </button>
            </span>
          </div>
          <ol className="n5-chat" aria-live="polite">
            {conversation.turns.map((turn) => (
              <li key={turn.seq} data-role={turn.role}>
                <span className="n5-chat-who">{turn.role === "tutor" ? "Haru" : "You"}</span>
                <div className="n5-bubble">
                  {turn.text ? (
                    <strong data-owned-japanese lang={ja}>
                      {turn.text}
                    </strong>
                  ) : (
                    <em className="n5-muted">{turn.input === "voice" ? "(spoken reply)" : "(reply)"}</em>
                  )}
                  {turn.role === "tutor" && turn.audio && (
                    <PlayButton path={`/conversations/${conversation.id}/turns/${turn.seq}/audio`} label="Haru's reply" compact />
                  )}
                  {showEnglish && turn.english && <small>{turn.english}</small>}
                  {turn.correction && (
                    <small className="n5-correction">
                      Try:{" "}
                      <span data-owned-japanese lang={ja}>
                        {turn.correction}
                      </span>
                    </small>
                  )}
                  {turn.tip && <small className="n5-tip">💡 {turn.tip}</small>}
                </div>
              </li>
            ))}
            {busy && pending && (
              <li data-role="learner" aria-busy>
                <span className="n5-chat-who">You</span>
                <div className="n5-bubble n5-muted">Haru is listening…</div>
              </li>
            )}
          </ol>
          {Boolean(error) && <Failure error={error} />}
          {pending && !busy && (
            <button type="button" className="n5-secondary" onClick={() => send(pending)}>
              Retry sending your reply
            </button>
          )}
          {conversation.status === "active" && !limitReached && !pending && (
            <div className="n5-speak-controls">
              {!typing ? (
                <>
                  <button
                    type="button"
                    className="n5-mic"
                    data-recording={recorder.phase === "recording" || undefined}
                    disabled={busy || recorder.phase === "requesting" || recorder.phase === "sending"}
                    onClick={() => (recorder.phase === "recording" ? stopRecording() : startRecording())}
                    aria-label={recorder.phase === "recording" ? "Stop recording and send" : "Start recording"}
                  >
                    <span aria-hidden>{recorder.phase === "recording" ? "■" : "🎙"}</span>
                  </button>
                  <p role="status" className="n5-muted">
                    {recorder.phase === "recording"
                      ? `Recording… tap to send (${remaining(recorder, now)}s left)`
                      : recorder.phase === "requesting"
                        ? "Allow microphone access to talk."
                        : recorder.phase === "sending" || busy
                          ? "Sending…"
                          : recorder.phase === "error"
                            ? recorder.reason === "denied"
                              ? "Microphone blocked. Type instead, or allow the mic in your browser settings."
                              : recorder.reason === "too_short"
                                ? "That was too short. Tap, speak, then tap again."
                                : recorder.reason === "unsupported"
                                  ? "This browser can't record audio. Type your replies instead."
                                  : "Couldn't send that recording. Try again."
                            : "Tap the mic, speak, tap again to send."}
                  </p>
                  <button type="button" className="n5-link" onClick={() => setTyping(true)}>
                    Type instead
                  </button>
                </>
              ) : (
                <form
                  className="n5-type"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) void send({ afterSeq: lastSeq, idempotencyKey: newKey(), text: draft.trim() });
                  }}
                >
                  <label htmlFor="n5-reply" className="n5-muted">
                    Type your reply in {lesson.script} (typed replies count as practice, not speaking)
                  </label>
                  <input id="n5-reply" value={draft} maxLength={300} lang={ja} autoComplete="off" spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
                  <div className="n5-actions">
                    <button className="n5-primary" disabled={busy || !draft.trim()}>
                      Send
                    </button>
                    {supported && (
                      <button type="button" className="n5-link" onClick={() => setTyping(false)}>
                        Use the microphone
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
          {conversation.status === "active" && (
            <div className="n5-actions n5-end">
              <button type="button" onClick={restart} disabled={busy}>
                Start over
              </button>
              <button type="button" className="n5-primary" disabled={busy || learnerTurns === 0} onClick={finish}>
                {busy && !pending ? "Scoring…" : "Finish and get feedback"}
              </button>
            </div>
          )}
          {result && (
            <div className="n5-speaking-result">
              <p className="n5-eyebrow">Your speaking result</p>
              <h2>
                {result.status === "demonstrated" ? "Speaking demonstrated ✓" : result.status === "needs_practice" ? "Nice start, keep practising" : "Typed practice complete"}
              </h2>
              <dl className="n5-skill-bars">
                {[
                  ["Task completion", result.taskCompletion],
                  ["Using this unit's Japanese", result.targetUse],
                  ["Conversation and repair", result.interaction],
                ].map(([label, score]) => (
                  <div key={label as string}>
                    <dt>{label}</dt>
                    <dd>
                      <span className="n5-bar" aria-hidden>
                        <span style={{ width: `${((score as number) / 3) * 100}%` }} />
                      </span>
                      {score} / 3
                    </dd>
                  </div>
                ))}
              </dl>
              <p>{result.summary}</p>
              {result.correction && (
                <p>
                  One correction:{" "}
                  <strong data-owned-japanese lang={ja}>
                    {result.correction}
                  </strong>
                </p>
              )}
              {result.status === "practice_only" && <p className="n5-muted">Typed replies don&apos;t count as speaking evidence. Use the microphone to demonstrate speaking.</p>}
              {result.status === "needs_practice" && result.spokenTurns < 3 && <p className="n5-muted">Speak at least three replies aloud to demonstrate speaking.</p>}
              <p className="n5-muted">Scored from transcripts, so pronunciation itself isn&apos;t judged.</p>
              <div className="n5-actions">
                <button type="button" className="n5-secondary" onClick={restart} disabled={busy}>
                  Practise again
                </button>
                {lesson.nextLessonId && (
                  <Link className="n5-primary" href={`/app/n5/lessons/${lesson.nextLessonId}`}>
                    Next unit →
                  </Link>
                )}
                <Link href="/app/n5">Course home</Link>
              </div>
            </div>
          )}
          {limitReached && conversation.status === "active" && <p className="n5-callout">That&apos;s ten replies. Finish to see your feedback.</p>}
        </section>
      )}
    </PlayerShell>
  );
}
