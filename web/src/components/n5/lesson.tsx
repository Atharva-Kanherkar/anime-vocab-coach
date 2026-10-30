"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { N5Attempt, N5Lesson, N5LessonProgress, N5Progress, N5Script, N5WatchLink } from "../../../../shared/n5/contracts";
import { REGION_NAMES, guessRegion, splitByRegion } from "@/lib/n5/region";
import { safeLink } from "@/lib/n5/core";
import { buildDrill, requeue, type DrillRound } from "@/lib/n5/drill";
import { CourseFailure, courseRequest, Failure, Loading, newKey, useCourse } from "./common";
import { PlayButton, playAudio } from "./audio";
import { PlayerShell } from "./player";
import { SECTIONS, STEP_INFO, completedSteps, markLocalStep, readLocalSteps, sectionIndex, stepsFor, type StepId } from "@/lib/n5/steps";

export function CourseLesson({ lessonId, ownerId, script }: { lessonId: string; ownerId: string; script?: N5Script }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [lesson, progress] = await Promise.all([
        courseRequest<N5Lesson>(`/lessons/${lessonId}${script ? `?script=${script}` : ""}`, undefined, undefined, signal),
        courseRequest<N5Progress>("/me/progress", undefined, undefined, signal),
      ]);
      const attempts = await Promise.allSettled(
        progress.attempts
          .filter((attempt) => attempt.status === "active" && (attempt.lessonId === undefined || attempt.lessonId === lesson.id))
          .map((attempt) => courseRequest<N5Attempt>(`/attempts/${attempt.id}`, undefined, undefined, signal)),
      );
      return {
        lesson,
        active: attempts.flatMap((result) =>
          result.status === "fulfilled" && result.value.lessonId === lesson.id && result.value.contentVersion === lesson.contentVersion ? [result.value] : [],
        ),
        watched: progress.observations.some((e) => e.episodeId === lesson.episodeId && e.kind === "watch_complete"),
        status: progress.lessons?.find((l) => l.lessonId === lesson.id) ?? null,
        completed: progress.attempts.filter((a) => a.status === "complete" && a.lessonId === lesson.id).reverse(),
      };
    },
    [lessonId, script],
  );
  const state = useCourse(load);
  if (state.error)
    return (
      <>
        <Failure error={state.error} />
        <Link href="/app/n5">Back to your course</Link>
      </>
    );
  if (!state.data) return <Loading variant="lesson" label="Opening your lesson…" />;
  return <LessonContent ownerId={ownerId} {...state.data} />;
}

type Step = "learn" | "drill" | "watch" | "practice" | "speak";
const STEPS: { id: Step; label: string }[] = [
  { id: "learn", label: "Learn" },
  { id: "drill", label: "Drill" },
  { id: "watch", label: "Watch" },
  { id: "practice", label: "Practice" },
  { id: "speak", label: "Speak" },
];

function LessonContent({
  lesson,
  watched: initialWatched,
  ownerId,
  active,
  status,
  completed,
}: {
  lesson: N5Lesson;
  watched: boolean;
  ownerId: string;
  active: N5Attempt[];
  status: N5LessonProgress | null;
  completed: N5Progress["attempts"];
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatched);
  const [local, setLocal] = useState<StepId[]>(() => readLocalSteps(ownerId, lesson.id));
  const steps = stepsFor(lesson.kind);
  const [step, setStep] = useState<Step>(() => {
    const hash = typeof location === "undefined" ? "" : location.hash.slice(1);
    if (steps.includes(hash as Step)) return hash as Step;
    return initialWatched || status?.status === "passed" || active.length ? "practice" : "learn";
  });
  function go(next: Step) {
    if (next === "speak") return router.push(`/app/n5/speak/${lesson.id}`);
    setStep(next);
    history.replaceState(null, "", `#${next}`);
    document.getElementById("n5-step")?.focus();
  }
  function complete(s: "learn" | "drill") {
    markLocalStep(ownerId, lesson.id, s);
    setLocal((all) => (all.includes(s) ? all : [...all, s]));
  }
  const doneSet = completedSteps(lesson.kind, status ? { ...status, watched: watched || status.watched } : { lessonId: lesson.id, status: "not_started", bestPercent: null, watched, speaking: "not_started" }, local);
  const position = steps.indexOf(step);
  const previous = steps[position - 1];
  const following = steps[position + 1];
  const section = SECTIONS[sectionIndex(lesson.unit)];
  const ja = lesson.script === "kana" ? "ja" : undefined;
  return (
    <PlayerShell ownerId={ownerId} lessonId={lesson.id} step={step} localDone={local} onStep={go}>
      <header className="n5-unit-head">
        <nav className="n5-crumbs n5-crumbs-light" aria-label="Breadcrumb">
          <Link href="/app/n5">Course home</Link> <span aria-hidden>›</span> Section {sectionIndex(lesson.unit) + 1}: {section.title} <span aria-hidden>›</span> Unit {lesson.unit}
        </nav>
        <p className="n5-eyebrow">
          Unit {lesson.unit} · {lesson.episode ? `Your Lie in April, episode ${lesson.episode.number}: ${lesson.episode.title}` : lesson.kind === "final" ? "Season final" : "Study unit"} · {lesson.script}
        </p>
        <h1>{lesson.title}</h1>
        <p className="n5-lead">{lesson.canDo}</p>
        <div className="n5-unit-stats">
          <span>
            <strong>{doneSet.size}</strong>/{steps.length} steps done
          </span>
          {status?.bestPercent != null && (
            <span>
              Best score <strong>{Math.round(status.bestPercent)}%</strong> {status.status === "passed" ? "· passed" : "· 80% passes"}
            </span>
          )}
          {status?.speaking === "demonstrated" && <span>Speaking demonstrated</span>}
        </div>
      </header>
      <nav className="n5-steps" aria-label="Lesson steps">
        {STEPS.filter((s) => steps.includes(s.id)).map((s, index) => (
          <button
            key={s.id}
            type="button"
            className="n5-step"
            aria-current={step === s.id ? "step" : undefined}
            data-done={doneSet.has(s.id) || undefined}
            onClick={() => go(s.id)}
          >
            <span className="n5-step-mark" data-done={doneSet.has(s.id) || undefined} aria-hidden>
              {doneSet.has(s.id) ? <Icon name="check" size={11} /> : index + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      <div id="n5-step" tabIndex={-1} className="n5-step-body">
        {step === "learn" && (
          <Learn
            lesson={lesson}
            ja={ja}
            onDone={() => {
              complete("learn");
              go("drill");
            }}
          />
        )}
        {step === "drill" && (
          <Drill
            lesson={lesson}
            onDone={() => {
              complete("drill");
              go(lesson.episode && !watched ? "watch" : "practice");
            }}
          />
        )}
        {step === "watch" && <Watch lesson={lesson} watched={watched} onWatched={() => setWatched(true)} ownerId={ownerId} onNext={() => go("practice")} />}
        {step === "practice" && <Practice lesson={lesson} ownerId={ownerId} active={active} completed={completed} watched={watched} onWatch={() => go("watch")} />}
        {step === "speak" && <SpeakIntro lesson={lesson} status={status} />}
      </div>
      <nav className="n5-step-nav" aria-label="Step navigation">
        {previous ? (
          <button type="button" onClick={() => go(previous)}>
            ← {STEP_INFO[previous].label}
          </button>
        ) : lesson.previousLessonId ? (
          <Link className="n5-secondary" href={`/app/n5/lessons/${lesson.previousLessonId}`}>
            ← Previous unit
          </Link>
        ) : (
          <span />
        )}
        {following ? (
          <button type="button" className="n5-primary" onClick={() => go(following)}>
            {STEP_INFO[following].label} →
          </button>
        ) : lesson.nextLessonId ? (
          <Link className="n5-primary" href={`/app/n5/lessons/${lesson.nextLessonId}`}>
            Next unit →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </PlayerShell>
  );
}

function Learn({ lesson, ja, onDone }: { lesson: N5Lesson; ja?: string; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [english, setEnglish] = useState(false);
  const card = lesson.vocabulary[index];
  const kana = lesson.script === "kana";
  function move(delta: number) {
    setFlipped(false);
    setIndex((i) => (i + delta + lesson.vocabulary.length) % lesson.vocabulary.length);
  }
  async function playAll() {
    for (const line of lesson.dialogue) {
      try {
        await playAudio(`/audio/${line.audio}`);
      } catch {
        return;
      }
    }
  }
  return (
    <>
      <section className="n5-panel" aria-labelledby="n5-words-title">
        <div className="n5-row">
          <h2 id="n5-words-title">Words</h2>
          <span className="n5-muted">
            {index + 1} / {lesson.vocabulary.length}
          </span>
        </div>
        {card && (
          <div
            className="n5-flashcard"
            data-flipped={flipped || undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(1);
              if (e.key === "ArrowLeft") move(-1);
            }}
          >
            <button type="button" className="n5-flashcard-face" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Show the word" : "Show the meaning"}>
              <strong data-owned-japanese lang={ja}>
                {card.reading}
              </strong>
              <span className="n5-flashcard-meaning" aria-live="polite">
                {flipped ? card.meaning : "Tap to reveal the meaning"}
              </span>
            </button>
            <PlayButton path={`/audio/${card.audio}`} label={card.reading} kana={kana ? card.reading : undefined} />
          </div>
        )}
        <div className="n5-actions">
          <button type="button" onClick={() => move(-1)}>
            ← Previous
          </button>
          <button type="button" onClick={() => move(1)}>
            Next →
          </button>
        </div>
        <details className="n5-wordlist">
          <summary>All {lesson.vocabulary.length} words</summary>
          <ul>
            {lesson.vocabulary.map((v) => (
              <li key={v.id}>
                <strong data-owned-japanese lang={ja}>
                  {v.reading}
                </strong>
                <span>{v.meaning}</span>
                <PlayButton path={`/audio/${v.audio}`} label={v.reading} kana={kana ? v.reading : undefined} compact slow={false} />
              </li>
            ))}
          </ul>
        </details>
      </section>
      {lesson.grammar.map((g) => (
        <section key={g.id} className="n5-panel n5-grammar">
          <p className="n5-eyebrow">Grammar</p>
          <h2>{g.title}</h2>
          <p>{g.explanation}</p>
          <ul className="n5-examples">
            {g.examples.map((e) => (
              <li key={e.audio}>
                <PlayButton path={`/audio/${e.audio}`} label={e.text} kana={kana ? e.text : undefined} compact />
                <span>
                  <strong data-owned-japanese lang={ja}>
                    {e.text}
                  </strong>
                  <small>{e.english}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="n5-panel">
        <div className="n5-row">
          <h2>Model conversation</h2>
          <span className="n5-actions">
            <button type="button" onClick={playAll}>
              <Icon name="play" size={12} /> Play all
            </button>
            <button type="button" aria-pressed={english} onClick={() => setEnglish((v) => !v)}>
              {english ? "Hide English" : "Show English"}
            </button>
          </span>
        </div>
        <ol className="n5-dialogue">
          {lesson.dialogue.map((line) => (
            <li key={line.audio} data-speaker={line.speaker}>
              <PlayButton path={`/audio/${line.audio}`} label={line.text} kana={kana ? line.text : undefined} compact slow={false} />
              <span>
                <strong data-owned-japanese lang={ja}>
                  {line.text}
                </strong>
                {english && <small>{line.english}</small>}
              </span>
            </li>
          ))}
        </ol>
        <p className="n5-muted">Original practice sentences written for this course, not lines from the show.</p>
      </section>
      <div className="n5-actions n5-end">
        <button type="button" className="n5-primary" onClick={onDone}>
          I&apos;ve studied these → Drill
        </button>
      </div>
    </>
  );
}

function Drill({ lesson, onDone }: { lesson: N5Lesson; onDone: () => void }) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  return <DrillRun key={seed} lesson={lesson} seed={seed} onAgain={() => setSeed(Math.floor(Math.random() * 1e9))} onDone={onDone} />;
}

function DrillRun({ lesson, seed, onAgain, onDone }: { lesson: N5Lesson; seed: number; onAgain: () => void; onDone: () => void }) {
  const cards = lesson.vocabulary;
  const [rounds, setRounds] = useState<DrillRound[]>(() => buildDrill(cards, seed));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, tried: 0 });
  const round = rounds[index];
  const ja = lesson.script === "kana" ? "ja" : undefined;
  useEffect(() => {
    if (round?.audio) playAudio(`/audio/${round.audio}`).catch(() => {});
  }, [round]);
  if (!round)
    return (
      <section className="n5-panel n5-drill-done" aria-live="polite">
        <p className="n5-eyebrow">Drill complete</p>
        <h2>
          {score.right} / {score.tried} right first time
        </h2>
        <p className="n5-muted">Missed words came back once. Drills are instant practice; they don&apos;t affect your score.</p>
        <div className="n5-actions">
          <button type="button" onClick={onAgain}>
            Drill again
          </button>
          <button type="button" className="n5-primary" onClick={onDone}>
            Continue →
          </button>
        </div>
      </section>
    );
  function choose(id: string) {
    if (picked) return;
    setPicked(id);
    const correct = id === round.answerId;
    if (!round.key.includes(":again:")) setScore((s) => ({ right: s.right + (correct ? 1 : 0), tried: s.tried + 1 }));
    setRounds((all) => requeue(all, index, correct, cards, seed));
  }
  return (
    <section className="n5-panel n5-drill" aria-live="polite">
      <div className="n5-progress" aria-hidden>
        <span style={{ width: `${(index / rounds.length) * 100}%` }} />
      </div>
      <p className="n5-eyebrow">
        {round.kind === "meaning" ? "Pick the Japanese" : round.kind === "word" ? "What does it mean?" : "Listen and pick the meaning"} · {index + 1} / {rounds.length}
      </p>
      {round.kind === "listen" ? (
        <div className="n5-drill-prompt">
          <PlayButton path={`/audio/${round.audio}`} label="the word" />
        </div>
      ) : (
        <p className="n5-drill-prompt" data-owned-japanese={round.kind === "word" || undefined} lang={round.kind === "word" ? ja : undefined}>
          {round.prompt}
        </p>
      )}
      <div className="n5-choices">
        {round.options.map((option, i) => (
          <button
            key={option.id}
            type="button"
            className="n5-choice"
            data-result={picked ? (option.id === round.answerId ? "right" : option.id === picked ? "wrong" : undefined) : undefined}
            disabled={Boolean(picked)}
            onClick={() => choose(option.id)}
          >
            <kbd aria-hidden>{i + 1}</kbd>
            <span data-owned-japanese={option.japanese || undefined} lang={option.japanese ? ja : undefined}>
              {option.label}
            </span>
          </button>
        ))}
      </div>
      {picked && (
        <div className="n5-feedback" data-result={picked === round.answerId ? "right" : "wrong"}>
          <strong>{picked === round.answerId ? "Correct!" : "Not quite."}</strong>
          {(() => {
            const card = cards.find((c) => c.id === round.cardId)!;
            return (
              <span>
                <span data-owned-japanese lang={ja}>
                  {card.reading}
                </span>{" "}
                = {card.meaning}
              </span>
            );
          })()}
          <button type="button" className="n5-primary" autoFocus onClick={() => { setPicked(null); setIndex((i) => i + 1); }}>
            Next
          </button>
        </div>
      )}
      <KeyChoices count={round.options.length} disabled={Boolean(picked)} onPick={(i) => choose(round.options[i].id)} />
    </section>
  );
}

/** Number keys pick choices while the round is open. */
export function KeyChoices({ count, disabled, onPick }: { count: number; disabled: boolean; onPick: (index: number) => void }) {
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) onPick(n - 1);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [count, disabled, onPick]);
  return null;
}

const ACCESS_LABEL: Record<N5WatchLink["access"], string> = { subscription: "Subscription", free_with_ads: "Free with ads", purchase: "Buy or rent" };

/** Every official service, the learner's likely region first. Nothing is hidden by region. */
function WhereToWatch({ lesson }: { lesson: N5Lesson }) {
  const [region] = useState(() => {
    try {
      return guessRegion(Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.languages ?? []);
    } catch {
      return null;
    }
  });
  const links = lesson.watchLinks.flatMap((l) => {
    const href = safeLink(l.url, "watch");
    return href ? [{ ...l, href }] : [];
  });
  if (!links.length) return null;
  const { local, other } = splitByRegion(links, region);
  const row = (l: (typeof links)[number]) => (
    <li key={l.provider + l.href}>
      <a href={l.href} target="_blank" rel="noopener noreferrer" className="n5-watch-link">
        <span className="n5-watch-name">
          <strong>{l.provider}</strong>
          <small>
            {ACCESS_LABEL[l.access]} · {l.regions.join(", ")}
            {l.note ? ` · ${l.note}` : ""}
          </small>
        </span>
        <span className="n5-watch-go">
          {l.scope === "episode" ? `Episode ${lesson.episode?.number}` : "Series page"}
          <Icon name="arrow-right" size={14} />
        </span>
      </a>
    </li>
  );
  const checked = links[0]?.checkedAt ? new Date(`${links[0].checkedAt}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;
  return (
    <div className="n5-where">
      {local.length > 0 && (
        <>
          <h3>Watch in {REGION_NAMES[region!] ?? region}</h3>
          <ul className="n5-watch-list">{local.map(row)}</ul>
        </>
      )}
      {other.length > 0 && (
        <details className="n5-watch-more" open={local.length === 0}>
          <summary>{local.length ? `Other regions (${other.length})` : "Where to watch"}</summary>
          <ul className="n5-watch-list">{other.map(row)}</ul>
        </details>
      )}
      <p className="n5-muted">
        Official services only, checked {checked}. Availability changes by country, and each service needs its own subscription. AnimeVocab isn&apos;t affiliated with them and doesn&apos;t track your playback.
      </p>
    </div>
  );
}

function Watch({ lesson, watched, onWatched, ownerId, onNext }: { lesson: N5Lesson; watched: boolean; onWatched: () => void; ownerId: string; onNext: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const source = lesson.summarySource ? safeLink(lesson.summarySource, "source") : null;
  async function markWatched() {
    if (!lesson.episodeId || busy) return;
    setBusy(true);
    setError(null);
    const storageKey = `avc:n5:op:${ownerId}:${lesson.id}:${lesson.contentVersion}:watch`;
    let key = newKey();
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && /^[a-zA-Z0-9_-]{1,100}$/.test(stored)) key = stored;
      else sessionStorage.setItem(storageKey, key);
    } catch {
      /* optional storage */
    }
    try {
      await courseRequest("/events", { episodeId: lesson.episodeId, kind: "watch_complete", idempotencyKey: key });
      onWatched();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (!lesson.episode)
    return (
      <section className="n5-panel">
        <h2>No episode for this unit</h2>
        <p>{lesson.hook}</p>
        <button type="button" className="n5-primary" onClick={onNext}>
          Go to practice →
        </button>
      </section>
    );
  return (
    <section className="n5-panel n5-watch">
      <p className="n5-eyebrow">Episode {lesson.episode.number}</p>
      <h2>{lesson.episode.title}</h2>
      <p className="n5-callout">
        <strong>While you watch:</strong> {lesson.hook}
      </p>
      <WhereToWatch lesson={lesson} />
      <p>With the AnimeVocab extension installed, this unit&apos;s words appear beside the video.</p>
      {!watched && (
        <div className="n5-actions">
          <button className="n5-primary" disabled={busy} onClick={markWatched}>
            {busy ? "Saving…" : `I watched episode ${lesson.episode.number}`}
          </button>
        </div>
      )}
      {Boolean(error) && <Failure error={error} />}
      {watched && lesson.summary && (
        <div className="n5-recap">
          <p className="n5-eyebrow">Episode recap</p>
          <p>{lesson.summary}</p>
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer">
              Official episode page ↗
            </a>
          )}
          <div className="n5-actions">
            <button type="button" className="n5-primary" onClick={onNext}>
              Practise this unit →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Practice({
  lesson,
  ownerId,
  active,
  completed,
  watched,
  onWatch,
}: {
  lesson: N5Lesson;
  ownerId: string;
  active: N5Attempt[];
  completed: N5Progress["attempts"];
  watched: boolean;
  onWatch: () => void;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const memoryKeys = useRef<Record<string, string>>({});
  // Start receipts are scoped by script, so a lost response never resumes another script's attempt.
  function operationKey(kind: string) {
    const storageKey = `avc:n5:op:${ownerId}:${lesson.id}:${lesson.contentVersion}:${lesson.script}:${kind}`;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && /^[a-zA-Z0-9_-]{1,100}$/.test(stored)) return { storageKey, key: stored };
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
  async function start() {
    if (lock.current) return;
    lock.current = true;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    const op = operationKey("start");
    try {
      const attempt = await courseRequest<N5Attempt>(
        "/attempts",
        { lessonId: lesson.id, contentVersion: lesson.contentVersion, script: lesson.script, idempotencyKey: op.key },
        undefined,
        abort.current.signal,
      );
      try {
        sessionStorage.removeItem(op.storageKey);
      } catch {}
      delete memoryKeys.current.start;
      router.push(`/app/n5/attempts/${attempt.id}`);
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const objective = lesson.questions.filter((q) => q.kind === "choice").length;
  const typed = lesson.questions.length - objective;
  return (
    <section className="n5-panel">
      <p className="n5-eyebrow">Practice</p>
      <h2>
        {objective} questions and {typed} short {lesson.script === "romaji" ? "romaji" : "kana"} answers
      </h2>
      <p>
        Vocabulary, grammar, reading and listening, graded on the server. Score 80% to pass the unit. Typed answers get AI feedback after you finish.
      </p>
      {lesson.episode && !watched && (
        <p className="n5-callout">
          Haven&apos;t watched episode {lesson.episode.number} yet? You can practise first, or{" "}
          <button type="button" className="n5-link" onClick={onWatch}>
            watch it now
          </button>
          .
        </p>
      )}
      {active.length > 0 && (
        <div aria-label="Unfinished practice" className="n5-stack">
          {active.map((attempt) => (
            <Link key={attempt.id} className="n5-primary" href={`/app/n5/attempts/${attempt.id}`}>
              Resume unfinished {attempt.script} practice
            </Link>
          ))}
          <p className="n5-muted">Starting another practice creates a separate attempt. You can keep up to five unfinished attempts.</p>
        </div>
      )}
      {Boolean(error) && <Failure error={error} />}
      {error instanceof CourseFailure && error.code === "enrolment_changed" && (
        <button className="n5-secondary" onClick={() => location.assign(`/app/n5/lessons/${lesson.id}`)}>
          Reload lesson
        </button>
      )}
      <div className="n5-actions">
        <button className="n5-primary n5-big" disabled={busy} onClick={start}>
          {busy ? "Opening practice…" : active.length ? "Start another practice" : "Begin practice"}
        </button>
      </div>
      {completed.length > 0 && (
        <div className="n5-history">
          <h3>Your results</h3>
          {completed.slice(0, 5).map((a) => (
            <Link key={a.id} href={`/app/n5/results/${a.id}`} className="n5-resume">
              {a.result ? `${a.result.correct}/${a.result.total} · ${Math.round(a.result.objectivePercent)}%${a.result.passed ? " · passed" : ""}` : "Result"} ({a.script})
              <span aria-hidden>→</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function SpeakIntro({ lesson, status }: { lesson: N5Lesson; status: N5LessonProgress | null }) {
  return (
    <section className="n5-panel n5-speak-intro">
      <p className="n5-eyebrow">Speak with Haru</p>
      <h2>{lesson.speaking.goal}</h2>
      <ul className="n5-goals">
        {lesson.speaking.prompts.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p>
        Haru is an AI conversation partner who uses this unit&apos;s words. Hold the mic to talk or type your replies. You&apos;ll get a short rubric and one correction at the end.
      </p>
      {status && status.speaking !== "not_started" && (
        <p className="n5-muted">
          Last result: {status.speaking === "demonstrated" ? "speaking demonstrated" : status.speaking === "needs_practice" ? "keep practising" : "typed practice only"}
        </p>
      )}
      <Link className="n5-primary n5-big" href={`/app/n5/speak/${lesson.id}`}>
        Start a conversation
      </Link>
    </section>
  );
}
