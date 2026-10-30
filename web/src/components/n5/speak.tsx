"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { callClock, rms, vadStart, vadStep } from "@/lib/n5/voice";
import { Icon } from "./icons";
import Link from "next/link";
import type { N5Conversation, N5Lesson } from "../../../../shared/n5/contracts";
import { MAX_RECORDING_MS, recorderTransition, recordingType, remaining } from "@/lib/n5/recorder";
import { CourseFailure, courseRequest, Failure, Loading, newKey, useCourse } from "./common";
import { PlayButton, playAudio, stopAudio } from "./audio";
import { PlayerShell, StepBar } from "./player";
import { StepGuide } from "./guide";
import { stepsFor } from "@/lib/n5/steps";

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
  if (!state.data) return <Loading variant="lesson" label="Getting Haru ready…" />;
  return <Speak lesson={state.data} ownerId={ownerId} />;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

type Presence = "idle" | "speaking" | "thinking" | "listening";
type Mic = { stream: MediaStream; ctx: AudioContext | null; analyser: AnalyserNode | null };

const lastSeqOf = (c: N5Conversation | null) => c?.turns[c.turns.length - 1]?.seq ?? 0;
const learnerCount = (c: N5Conversation | null) => c?.turns.filter((t) => t.role === "learner").length ?? 0;

/**
 * Haru's presence: a soft orb that breathes when idle, ripples while Haru talks,
 * turns while thinking and follows your voice while listening.
 */
function Orb({ presence }: { presence: Presence }) {
  return (
    <div className="n5-orb" data-presence={presence} aria-hidden>
      <span className="n5-orb-ring" />
      <span className="n5-orb-ring" />
      <span className="n5-orb-ring" />
      <span className="n5-orb-core">
        <span className="n5-orb-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    </div>
  );
}

function Speak({ lesson, ownerId }: { lesson: N5Lesson; ownerId: string }) {
  const [conversation, setConversation] = useState<N5Conversation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<TurnBody | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [captions, setCaptions] = useState(true);
  const [handsFree, setHandsFree] = useState(true);
  const [haruSpeaking, setHaruSpeaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [recorder, dispatch] = useReducer(recorderTransition, { phase: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const conv = useRef<N5Conversation | null>(null);
  const mic = useRef<Mic | null>(null);
  const opening = useRef(false);
  const media = useRef<{ recorder: MediaRecorder; chunks: Blob[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const frame = useRef<number | null>(null);
  /** The call surface; it carries the live mic level for the orb and mic button. */
  const orb = useRef<HTMLElement>(null);
  const live = useRef({ handsFree, typing });
  const spoken = useRef(new Set<number>());
  const ja = lesson.script === "kana" ? "ja" : undefined;
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  const steps = stepsFor(lesson.kind);

  useEffect(() => {
    live.current = { handsFree, typing };
  }, [handsFree, typing]);
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (media.current) clearTimeout(media.current.timer);
      mic.current?.stream.getTracks().forEach((t) => t.stop());
      void mic.current?.ctx?.close().catch(() => {});
      stopAudio();
    },
    [],
  );
  useEffect(() => {
    if (!startedAt || conversation?.status !== "active") return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [startedAt, conversation?.status]);

  function show(next: N5Conversation) {
    conv.current = next;
    setConversation(next);
  }

  function closeMic() {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    mic.current?.stream.getTracks().forEach((t) => t.stop());
    void mic.current?.ctx?.close().catch(() => {});
    mic.current = null;
  }

  /** After Haru finishes talking, a hands-free call hands the turn straight back to you. */
  function afterHaru() {
    setHaruSpeaking(false);
    const c = conv.current;
    if (!c || c.status !== "active" || learnerCount(c) >= c.maxLearnerTurns) return;
    if (!live.current.handsFree || live.current.typing || !mic.current) return;
    void startRecording();
  }

  /** Haru says each new reply once; the call waits for the voice to finish. */
  function speakNew(next: N5Conversation) {
    const latest = [...next.turns].reverse().find((t) => t.role === "tutor");
    if (!latest || spoken.current.has(latest.seq) || !latest.audio) {
      if (latest) spoken.current.add(latest.seq);
      afterHaru();
      return;
    }
    spoken.current.add(latest.seq);
    setHaruSpeaking(true);
    playAudio(`/conversations/${next.id}/turns/${latest.seq}/audio`)
      .catch(() => {})
      .finally(afterHaru);
  }

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const started = await courseRequest<N5Conversation>("/conversations", { lessonId: lesson.id, idempotencyKey: storedKey(ownerId, lesson.id) });
      for (const t of started.turns.slice(0, -1)) spoken.current.add(t.seq);
      show(started);
      setStartedAt(Date.now());
      setNow(Date.now());
      if (started.status === "active") speakNew(started);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function send(body: TurnBody) {
    const current = conv.current;
    if (!current) return;
    setBusy(true);
    setError(null);
    setPending(body);
    try {
      const next = await courseRequest<N5Conversation>(`/conversations/${current.id}/turns`, body);
      setPending(null);
      show(next);
      setDraft("");
      dispatch({ type: "sent" });
      speakNew(next);
    } catch (e) {
      // Keep the same key so a retry after a lost response can't double-post.
      if (e instanceof CourseFailure && e.status < 500 && e.status !== 408 && e.status !== 429) setPending(null);
      if (e instanceof CourseFailure && e.code === "conflict") {
        try {
          show(await courseRequest<N5Conversation>(`/conversations/${current.id}`));
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

  async function openMic(): Promise<MediaStream> {
    if (mic.current) return mic.current.stream;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      ctx = new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
    } catch {
      /* without levels, replies are sent with the mic button */
    }
    mic.current = { stream, ctx, analyser };
    return stream;
  }

  /** Follow the learner's voice: drive the orb, and end the turn on a pause. */
  function listen() {
    const current = mic.current;
    if (!current?.analyser) return;
    void current.ctx?.resume().catch(() => {});
    const analyser = current.analyser;
    const samples = new Float32Array(analyser.fftSize);
    let vad = vadStart(performance.now());
    const tick = () => {
      if (!media.current) return;
      analyser.getFloatTimeDomainData(samples);
      const level = rms(samples);
      orb.current?.style.setProperty("--n5-level", Math.min(1, level * 9).toFixed(3));
      const step = vadStep(vad, level, performance.now());
      vad = step.state;
      if (live.current.handsFree && step.event === "end") return stopRecording();
      if (live.current.handsFree && step.event === "idle") return cancelRecording("I didn't hear anything, so I stopped listening. Tap the mic when you're ready.");
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  async function startRecording() {
    if (!supported) {
      dispatch({ type: "unsupported" });
      setTyping(true);
      return;
    }
    if (media.current || opening.current) return;
    stopAudio();
    setHint(null);
    opening.current = true;
    dispatch({ type: "request" });
    try {
      const stream = await openMic();
      const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(stream, preferred ? { mimeType: preferred, audioBitsPerSecond: 32_000 } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start();
      const timer = setTimeout(() => stopRecording(), MAX_RECORDING_MS);
      media.current = { recorder: rec, chunks, timer };
      dispatch({ type: "granted", at: Date.now() });
      listen();
    } catch {
      closeMic();
      dispatch({ type: "denied" });
      setTyping(true);
    } finally {
      opening.current = false;
    }
  }

  function endListening() {
    const current = media.current;
    media.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = null;
    orb.current?.style.setProperty("--n5-level", "0");
    if (current) clearTimeout(current.timer);
    return current;
  }

  function stopRecording() {
    const current = endListening();
    if (!current) return;
    const at = Date.now();
    current.recorder.onstop = async () => {
      const type = recordingType(current.recorder.mimeType || current.chunks[0]?.type || "");
      const blob = new Blob(current.chunks, { type: current.recorder.mimeType });
      if (!type || blob.size < 200) {
        dispatch({ type: "failed" });
        return;
      }
      await send({ afterSeq: lastSeqOf(conv.current), idempotencyKey: newKey(), audio: { data: await toBase64(blob), mime: type } });
    };
    dispatch({ type: "stop", at });
    if (current.recorder.state !== "inactive") current.recorder.stop();
  }

  /** Drop the recording without sending and free the microphone. */
  function cancelRecording(why?: string) {
    const current = endListening();
    if (!current) return;
    current.recorder.onstop = null;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    closeMic();
    dispatch({ type: "cancel" });
    if (why) setHint(why);
  }

  async function finish() {
    const current = conv.current;
    if (!current) return;
    cancelRecording();
    closeMic();
    stopAudio();
    setHint(null);
    setBusy(true);
    setError(null);
    try {
      show(await courseRequest<N5Conversation>(`/conversations/${current.id}/finish`, {}));
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
    const current = conv.current;
    if (!current) return;
    cancelRecording();
    closeMic();
    stopAudio();
    setHint(null);
    setBusy(true);
    try {
      if (current.status === "active") await courseRequest(`/conversations/${current.id}`, undefined, "DELETE");
      try {
        sessionStorage.removeItem(startKey(ownerId, lesson.id));
      } catch {
        /* optional storage */
      }
      spoken.current.clear();
      conv.current = null;
      setConversation(null);
      setPending(null);
      setStartedAt(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const learnerTurns = learnerCount(conversation);
  const limitReached = conversation ? learnerTurns >= conversation.maxLearnerTurns : false;
  const active = conversation?.status === "active";
  const presence: Presence =
    recorder.phase === "recording" ? "listening" : busy || recorder.phase === "sending" ? "thinking" : haruSpeaking ? "speaking" : "idle";
  const haru = conversation ? [...conversation.turns].reverse().find((t) => t.role === "tutor") : undefined;
  const you = conversation ? [...conversation.turns].reverse().find((t) => t.role === "learner") : undefined;
  const result = conversation?.result;
  const status =
    recorder.phase === "recording"
      ? handsFree
        ? "Listening… just talk, and pause when you're done."
        : `Listening… tap the mic to send (${remaining(recorder, now)}s left)`
      : presence === "thinking"
        ? pending
          ? "Haru is thinking…"
          : "One moment…"
        : presence === "speaking"
          ? "Haru is speaking"
          : recorder.phase === "requesting"
            ? "Allow microphone access to talk."
            : recorder.phase === "error"
              ? recorder.reason === "denied"
                ? "Microphone blocked. Type instead, or allow the mic in your browser settings."
                : recorder.reason === "too_short"
                  ? "That was too short. Tap the mic and try again."
                  : recorder.reason === "unsupported"
                    ? "This browser can't record audio. Type your replies instead."
                    : "Couldn't send that recording. Try again."
              : limitReached
                ? "That's ten replies. End the call to get your feedback."
                : (hint ?? (typing ? "Your turn. Type your reply below." : "Your turn. Tap the mic and answer Haru."));
  const micLabel = recorder.phase === "recording" ? "Stop recording and send" : haruSpeaking ? "Interrupt Haru and answer" : "Start recording";

  const transcript = conversation && (
    <aside className="n5-call-transcript" aria-label="Transcript">
      <div className="n5-row">
        <h2>Transcript</h2>
        <span className="n5-muted">
          {learnerTurns} / {conversation.maxLearnerTurns} replies
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
              {turn.role === "tutor" && turn.audio && <PlayButton path={`/conversations/${conversation.id}/turns/${turn.seq}/audio`} label="Haru's reply" compact />}
              {captions && turn.english && <small>{turn.english}</small>}
              {turn.correction && (
                <small className="n5-correction">
                  Try:{" "}
                  <span data-owned-japanese lang={ja}>
                    {turn.correction}
                  </span>
                </small>
              )}
            </div>
          </li>
        ))}
        {busy && pending && (
          <li data-role="learner" aria-busy>
            <span className="n5-chat-who">You</span>
            <div className="n5-bubble n5-muted">Sending…</div>
          </li>
        )}
      </ol>
    </aside>
  );

  return (
    <PlayerShell ownerId={ownerId} lessonId={lesson.id} step="speak">
      <section ref={orb} className="n5-call" data-presence={conversation ? presence : "idle"} data-state={!conversation ? "lobby" : result ? "done" : "live"} aria-labelledby="n5-call-goal">
        <header className="n5-call-top">
          <span className="n5-call-who">
            <span className="n5-call-dot" data-live={active || undefined} />
            {conversation ? (active ? "On a call with Haru" : "Call ended") : "Speak with Haru"} · Unit {lesson.unit}
          </span>
          {conversation && <span className="n5-call-clock">{callClock(startedAt ? now - startedAt : 0)}</span>}
          {conversation && active && (
            <button type="button" className="n5-call-icon" onClick={restart} disabled={busy} aria-label="Start over" title="Start over">
              <Icon name="restart" size={18} />
            </button>
          )}
        </header>
        <div className="n5-call-body">
          <div className="n5-call-stage">
            {!result && <Orb presence={conversation ? presence : "idle"} />}
            {!conversation ? (
              <div className="n5-call-lobby">
                <p className="n5-call-name">Haru</p>
                <p className="n5-call-role">Your Japanese classmate</p>
                <h1 id="n5-call-goal">{lesson.speaking.goal}</h1>
                <ul className="n5-call-goals">
                  {lesson.speaking.prompts.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                {Boolean(error) && <Failure error={error} />}
                <button className="n5-call-start" disabled={busy} onClick={begin}>
                  <Icon name="phone" size={20} />
                  {busy ? "Connecting…" : "Start conversation"}
                </button>
                <p className="n5-call-note">Haru talks first. Then just answer out loud: it&apos;s a hands-free call, and you can type instead at any time. Recordings are transcribed, then discarded; only the text is saved.</p>
              </div>
            ) : result ? (
              <div className="n5-speaking-result n5-call-result">
                <p className="n5-eyebrow">Your speaking result</p>
                <h1 id="n5-call-goal">
                  {result.status === "demonstrated" ? "Speaking demonstrated" : result.status === "needs_practice" ? "Nice start, keep practising" : "Typed practice complete"}
                </h1>
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
                    <Icon name="restart" /> Practise again
                  </button>
                  {lesson.nextLessonId && (
                    <Link className="n5-primary" href={`/app/n5/lessons/${lesson.nextLessonId}`}>
                      Next unit <Icon name="arrow-right" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="n5-call-captions">
                <h1 id="n5-call-goal" className="n5-visually-hidden">
                  {lesson.speaking.goal}
                </h1>
                <p className="n5-call-status" role="status">
                  {status}
                </p>
                {you?.text && (
                  <p className="n5-call-you">
                    <span>You</span>{" "}
                    <span data-owned-japanese lang={ja}>
                      {you.text}
                    </span>
                  </p>
                )}
                {haru?.text && (
                  <p className="n5-call-line" key={haru.seq} data-owned-japanese lang={ja}>
                    {haru.text}
                  </p>
                )}
                {captions && haru?.english && <p className="n5-call-english">{haru.english}</p>}
                {(haru?.correction || haru?.tip) && (
                  <div className="n5-call-help">
                    {haru.correction && (
                      <span className="n5-correction">
                        Try:{" "}
                        <span data-owned-japanese lang={ja}>
                          {haru.correction}
                        </span>
                      </span>
                    )}
                    {haru.tip && (
                      <span className="n5-tip">
                        <Icon name="bulb" size={13} /> {haru.tip}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {transcript}
        </div>
        {conversation && active && (
          <div className="n5-call-foot">
            {Boolean(error) && <Failure error={error} />}
            {pending && !busy && (
              <button type="button" className="n5-secondary" onClick={() => send(pending)}>
                Retry sending your reply
              </button>
            )}
            {typing && !limitReached && !pending && (
              <form
                className="n5-type"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) void send({ afterSeq: lastSeqOf(conv.current), idempotencyKey: newKey(), text: draft.trim() });
                }}
              >
                <label htmlFor="n5-reply">Type your reply in {lesson.script} (typed replies count as practice, not speaking)</label>
                <div className="n5-type-row">
                  <input id="n5-reply" value={draft} maxLength={300} lang={ja} autoComplete="off" spellCheck={false} onChange={(e) => setDraft(e.target.value)} />
                  <button className="n5-primary" disabled={busy || !draft.trim()}>
                    Send
                  </button>
                </div>
              </form>
            )}
            <div className="n5-call-dock">
              <button type="button" className="n5-dock-button" aria-pressed={captions} onClick={() => setCaptions((v) => !v)}>
                <Icon name="captions" size={20} />
                <span>English</span>
              </button>
              <button
                type="button"
                className="n5-dock-button"
                aria-pressed={handsFree}
                onClick={() => setHandsFree((v) => !v)}
                title="When on, the mic opens after Haru speaks and sends when you pause"
              >
                <Icon name="wave" size={20} />
                <span>Hands-free</span>
              </button>
              {!typing ? (
                <button
                  type="button"
                  className="n5-mic"
                  data-recording={recorder.phase === "recording" || undefined}
                  disabled={limitReached || Boolean(pending) || busy || recorder.phase === "requesting" || recorder.phase === "sending"}
                  onClick={() => (recorder.phase === "recording" ? stopRecording() : startRecording())}
                  aria-label={micLabel}
                >
                  <Icon name={recorder.phase === "recording" ? "stop" : "mic"} size={30} />
                </button>
              ) : (
                <button type="button" className="n5-mic n5-mic-off" disabled={!supported} onClick={() => setTyping(false)} aria-label="Use the microphone">
                  <Icon name="mic" size={30} />
                </button>
              )}
              <button
                type="button"
                className="n5-dock-button"
                aria-pressed={typing}
                onClick={() => {
                  if (!typing) cancelRecording();
                  setTyping((v) => !v);
                }}
              >
                <Icon name="keyboard" size={20} />
                <span>Type instead</span>
              </button>
              <button type="button" className="n5-dock-button n5-dock-end" disabled={busy || learnerTurns === 0} onClick={finish}>
                <Icon name="phone-off" size={20} />
                <span>{busy && !pending ? "Scoring…" : "End call"}</span>
              </button>
            </div>
            <p className="n5-call-hint">{learnerTurns === 0 ? "Answer at least once, then end the call for feedback." : "End the call any time to get your feedback."}</p>
          </div>
        )}
      </section>
      {!conversation && <StepGuide step="speak" position={steps.length} total={steps.length} />}
      <StepBar lessonId={lesson.id} steps={steps} step="speak" previousLessonId={lesson.previousLessonId} nextLessonId={lesson.nextLessonId} />
    </PlayerShell>
  );
}
