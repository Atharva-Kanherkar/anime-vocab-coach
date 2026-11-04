// The end-of-episode quiz on the player: a small nudge when the episode ends,
// then a modal with the questions, the score, flashcards from the misses, and
// Haru (Pro/Max) judging a sentence the learner writes.
//
// Everything the model wrote is set with textContent, never innerHTML. Both
// surfaces live in shadow roots marked as ours, so the page cannot restyle
// them and the player's keyboard shortcuts cannot steal the learner's typing.

import { WEB_URL } from "../config";
import * as dict from "./dictionary";
import * as storage from "./storage";
import { speakText } from "./tts-client";
import { trackFeature, trackPro } from "./feature-events";
import { UI_HOST_ATTR, keepFocusOnMouseClick } from "./key-shield";
import { EPISODE_QUIZ_MESSAGE, type EpisodeQuizResponse } from "./episode-quiz-client";
import {
  isCorrect,
  missedWords,
  practiceWords,
  scoreQuiz,
  shuffled,
  verdictFor,
  type QuizAnswer,
  type QuizLine,
  type QuizQuestion,
} from "./episode-quiz";

type Plan = "free" | "pro" | "max";

const STYLES = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .nudge, .card {
    color: #f4f4f6;
    background: #16171d;
    border: 1px solid rgba(255,255,255,.14);
    box-shadow: 0 12px 36px rgba(0,0,0,.45);
    font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
  }
  .nudge { position: fixed; right: 20px; bottom: 84px; z-index: 2147483000; width: 312px; padding: 14px 16px 12px; border-radius: 14px; }
  .backdrop { position: fixed; inset: 0; z-index: 2147483001; display: grid; place-items: center; background: rgba(6,7,10,.72); }
  .card { width: min(560px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto; padding: 20px 22px; border-radius: 16px; }
  .top { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; color: #b9bac4; font-size: 12px; }
  .top .grow { flex: 1; }
  .bar { height: 4px; border-radius: 4px; background: rgba(255,255,255,.1); overflow: hidden; margin-bottom: 16px; }
  .bar i { display: block; height: 100%; background: #8ab4ff; transition: width .2s; }
  h2 { margin: 0 0 4px; font-size: 16px; font-weight: 650; }
  .note { margin: 0 0 12px; color: #b9bac4; font-size: 12px; }
  .kind { display: inline-block; margin-bottom: 8px; padding: 2px 8px; border-radius: 99px; background: rgba(138,180,255,.15); color: #b8d0ff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .prompt { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
  .quote { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.06); font-size: 18px; }
  .quote span { flex: 1; }
  .choices { display: grid; gap: 8px; }
  button { font: inherit; color: inherit; cursor: pointer; }
  .choice { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.14); background: transparent; }
  .choice:hover:not([disabled]) { background: rgba(255,255,255,.06); }
  .choice.right { border-color: #4ade80; background: rgba(74,222,128,.14); }
  .choice.wrong { border-color: #f87171; background: rgba(248,113,113,.14); }
  .choice[disabled] { cursor: default; }
  .tiles { display: flex; flex-wrap: wrap; gap: 8px; min-height: 44px; padding: 8px; border-radius: 10px; border: 1px dashed rgba(255,255,255,.2); margin-bottom: 10px; font-size: 17px; }
  .tile { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.06); }
  .tile[disabled] { opacity: .3; cursor: default; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 14px; }
  .row .grow { flex: 1; }
  .cta { min-height: 38px; padding: 0 16px; border: 0; border-radius: 9px; background: #f4f4f6; color: #16171d; font-weight: 650; }
  .cta:hover:not([disabled]) { background: #fff; }
  .cta[disabled] { opacity: .5; cursor: default; }
  .ghost { min-height: 38px; padding: 0 14px; border-radius: 9px; border: 1px solid rgba(255,255,255,.18); background: transparent; }
  .quiet { min-height: 32px; padding: 0 8px; border: 0; background: transparent; color: #9a9ba6; font-size: 12px; }
  .icon { width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #9a9ba6; font-size: 18px; line-height: 1; }
  .icon:hover, .quiet:hover { color: #f4f4f6; background: rgba(255,255,255,.08); }
  .feedback { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,.05); font-size: 13px; }
  .feedback b { display: block; margin-bottom: 2px; }
  .ok b { color: #4ade80; } .no b { color: #f87171; }
  .score { display: flex; align-items: baseline; gap: 12px; margin: 4px 0 6px; }
  .score strong { font-size: 44px; font-weight: 700; letter-spacing: -.02em; }
  .score span { color: #b9bac4; font-size: 18px; }
  .missed { margin: 10px 0 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; }
  .missed li { padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,.04); }
  .missed em { font-style: normal; color: #4ade80; }
  .section { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.1); }
  .haru { display: flex; gap: 10px; align-items: flex-start; }
  .orb { flex: none; width: 34px; height: 34px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #b8d0ff, #6b8cff 60%, #3a4fb8); }
  textarea { width: 100%; min-height: 64px; margin-top: 8px; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); color: inherit; font: inherit; font-size: 16px; resize: vertical; }
  .lock { color: #b9bac4; font-size: 13px; }
  .pill { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 99px; background: rgba(255,214,102,.16); color: #ffd666; font-size: 11px; font-weight: 600; }
  :focus-visible { outline: 2px solid #8ab4ff; outline-offset: 2px; }
  .spin { width: 22px; height: 22px; border: 2px solid rgba(255,255,255,.2); border-top-color: #8ab4ff; border-radius: 50%; animation: s 0.8s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: no-preference) {
    .nudge, .card { animation: rise 160ms ease-out; }
    @keyframes rise { from { opacity: 0; transform: translateY(6px); } }
  }
`;

const KIND_LABEL: Record<QuizQuestion["kind"], string> = {
  meaning: "Word",
  line: "Line",
  story: "Story",
  build: "Build a sentence",
};

const ERROR_COPY: Record<string, string> = {
  not_linked: "Sign in to AnimeVocab to take the quiz.",
  unauthorized: "Your sign-in expired. Open AnimeVocab to sign in again.",
  ai_quota_exhausted: "You've used this month's AI allowance, so there's no quiz this time.",
  too_few_lines: "Not enough of this episode's dialogue came through to write a quiz.",
  network: "Couldn't reach AnimeVocab. Check your connection and try again.",
};

/** Next-episode controls on the players we support. */
const NEXT_EPISODE_SELECTORS = [
  '[data-uia="next-episode-seamless-button"]',
  '[data-uia="next-episode-seamless-button-draining"]',
  '[data-uia="control-next"]',
  '[data-testid="vilos-next_episode_button"]',
  '[data-t="next-episode"] a',
  ".ytp-next-button",
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function shadowHost(attr: string): { host: HTMLDivElement; root: ShadowRoot } {
  const host = document.createElement("div");
  host.setAttribute(attr, "");
  host.setAttribute(UI_HOST_ATTR, "");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  root.appendChild(style);
  keepFocusOnMouseClick(root);
  return { host, root };
}

function playerParent(): HTMLElement | null {
  return (document.fullscreenElement as HTMLElement | null) || document.body;
}

/** Keep a host inside the fullscreen element, like the Lens and the sign-in chip. */
function followFullscreen(host: HTMLElement): () => void {
  const move = (): void => {
    const parent = playerParent();
    if (parent && host.parentElement !== parent) parent.appendChild(host);
  };
  document.addEventListener("fullscreenchange", move);
  return () => document.removeEventListener("fullscreenchange", move);
}

// ── The nudge ────────────────────────────────────────────────────────────────

let nudgeHost: HTMLDivElement | null = null;
let nudgeUnfollow: (() => void) | null = null;

export interface NudgeHandlers {
  onStart: () => void;
  onLater: () => void;
  onOff: () => void;
}

export function isQuizNudgeUp(): boolean {
  return !!nudgeHost;
}

export function showQuizNudge(h: NudgeHandlers): void {
  if (nudgeHost) return;
  const parent = playerParent();
  if (!parent) return;
  const { host, root } = shadowHost("data-avc-quiz-nudge");
  const card = el("div", "nudge");
  card.setAttribute("role", "region");
  card.setAttribute("aria-label", "Episode quiz");
  const head = el("div", "row");
  head.style.marginTop = "0";
  head.appendChild(el("h2", "grow", "Episode done! Quick quiz on what you just watched?"));
  head.appendChild(button("icon", "×", () => { hideQuizNudge(); h.onLater(); }));
  head.lastElementChild?.setAttribute("aria-label", "Not now");
  card.appendChild(head);
  card.appendChild(el("p", "note", "About 12 questions, 3 minutes. A nudge, not a test."));
  const row = el("div", "row");
  row.appendChild(button("cta grow", "Start quiz", () => { hideQuizNudge(); h.onStart(); }));
  row.appendChild(button("ghost", "Not now", () => { hideQuizNudge(); h.onLater(); }));
  card.appendChild(row);
  card.appendChild(button("quiet", "Don't ask after episodes", () => { hideQuizNudge(); h.onOff(); }));
  root.appendChild(card);
  parent.appendChild(host);
  nudgeHost = host;
  nudgeUnfollow = followFullscreen(host);
}

export function hideQuizNudge(): void {
  nudgeUnfollow?.();
  nudgeUnfollow = null;
  nudgeHost?.remove();
  nudgeHost = null;
}

// ── The quiz ─────────────────────────────────────────────────────────────────

export interface OpenQuizOptions {
  title: string | null;
  direction: "en-ja" | "ja-en";
  lines: QuizLine[];
  known: string[];
  plan: Plan;
  getVideo: () => HTMLVideoElement | null;
  onClose?: () => void;
}

let quizHost: HTMLDivElement | null = null;
let quizUnfollow: (() => void) | null = null;

export function isQuizOpen(): boolean {
  return !!quizHost;
}

export function closeQuiz(): void {
  quizUnfollow?.();
  quizUnfollow = null;
  quizHost?.remove();
  quizHost = null;
}

async function ask(payload: Record<string, unknown>): Promise<EpisodeQuizResponse> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: EPISODE_QUIZ_MESSAGE, payload })) as EpisodeQuizResponse | undefined;
    return res || { ok: false, error: "network" };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Click the site's next-episode control, or carry on playing; true when something happened. */
export function continueWatching(video: HTMLVideoElement | null, doc: Document = document): boolean {
  for (const sel of NEXT_EPISODE_SELECTORS) {
    const next = doc.querySelector<HTMLElement>(sel);
    if (next) {
      next.click();
      return true;
    }
  }
  if (video && !video.ended) {
    void video.play().catch(() => {});
    return true;
  }
  return false;
}

export function openQuiz(opts: OpenQuizOptions): void {
  if (quizHost) return;
  const parent = playerParent();
  if (!parent) return;
  const { host, root } = shadowHost("data-avc-episode-quiz");
  const backdrop = el("div", "backdrop");
  const card = el("div", "card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-label", "Episode quiz");
  backdrop.appendChild(card);
  root.appendChild(backdrop);
  parent.appendChild(host);
  quizHost = host;
  quizUnfollow = followFullscreen(host);

  const paid = opts.plan === "pro" || opts.plan === "max";
  const close = (): void => {
    closeQuiz();
    opts.onClose?.();
  };
  backdrop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  const top = (label: string): HTMLDivElement => {
    const t = el("div", "top");
    t.appendChild(el("span", "grow", label));
    const x = button("icon", "×", close);
    x.setAttribute("aria-label", "Close quiz");
    t.appendChild(x);
    return t;
  };

  const message = (text: string): void => {
    card.replaceChildren(top(opts.title || "Episode check"), el("p", "", text));
    const row = el("div", "row");
    row.appendChild(button("cta", "Close", close));
    card.appendChild(row);
  };

  // Loading
  const loading = el("div", "row");
  loading.appendChild(el("div", "spin"));
  loading.appendChild(el("span", "", "Writing a quiz from this episode's lines…"));
  card.replaceChildren(top(opts.title || "Episode check"), loading);
  void trackFeature("quiz_started");

  void ask({ mode: "generate", title: opts.title || "", direction: opts.direction, lines: opts.lines, known: opts.known }).then((res) => {
    if (!quizHost) return;
    const questions = (res.ok && Array.isArray(res.data?.questions) ? res.data.questions : []) as QuizQuestion[];
    if (!res.ok || !questions.length) {
      message(ERROR_COPY[res.error || ""] || "Couldn't write a quiz for this episode. Try again after the next one.");
      return;
    }
    runQuestions(questions);
  });

  function speakButton(text: string): HTMLButtonElement {
    const b = button("icon", "\u{1F50A}", () => void speakText(text));
    b.setAttribute("aria-label", "Haru reads it aloud");
    b.title = "Haru reads it aloud";
    return b;
  }

  function runQuestions(questions: QuizQuestion[]): void {
    const answers: QuizAnswer[] = questions.map(() => null);
    let i = 0;

    const render = (): void => {
      const q = questions[i];
      const bar = el("div", "bar");
      const fill = el("i");
      fill.style.width = `${(i / questions.length) * 100}%`;
      bar.appendChild(fill);
      card.replaceChildren(top(`${opts.title || "Episode check"} · ${i + 1} / ${questions.length}`), bar);
      card.appendChild(el("span", "kind", KIND_LABEL[q.kind]));
      card.appendChild(el("p", "prompt", q.prompt));
      if (q.quote && q.kind !== "build") {
        const quote = el("div", "quote");
        const span = el("span", "", q.quote);
        span.lang = opts.direction === "ja-en" ? "en" : "ja";
        quote.appendChild(span);
        if (paid) quote.appendChild(speakButton(q.quote));
        card.appendChild(quote);
      }

      const feedback = el("div");
      const next = button("cta", i + 1 < questions.length ? "Next" : "See my score", () => {
        i++;
        if (i < questions.length) render();
        else results(questions, answers);
      });
      const after = (): void => {
        const right = isCorrect(q, answers[i]);
        feedback.className = `feedback ${right ? "ok" : "no"}`;
        feedback.replaceChildren(el("b", "", right ? "Right!" : "Not quite."));
        if (!right && q.kind === "build" && q.tiles) {
          const correct = el("div", "", q.quote || q.tiles.join(""));
          correct.lang = opts.direction === "ja-en" ? "en" : "ja";
          feedback.appendChild(correct);
        }
        if (q.explain) feedback.appendChild(el("div", "", q.explain));
        if (q.kind === "build" && paid && q.quote) feedback.appendChild(speakButton(q.quote));
        const row = el("div", "row");
        row.appendChild(el("span", "grow"));
        row.appendChild(next);
        card.append(feedback, row);
        next.focus();
      };

      if (q.kind === "build" && q.tiles) {
        const picked: string[] = [];
        const answer = el("div", "tiles");
        answer.setAttribute("aria-label", "Your sentence");
        const pool = el("div", "tiles");
        const check = button("cta", "Check", () => {
          answers[i] = picked.slice();
          pool.querySelectorAll("button").forEach((b) => ((b as HTMLButtonElement).disabled = true));
          controls.remove();
          after();
        });
        const sync = (): void => {
          answer.replaceChildren(...picked.map((t) => el("span", "tile", t)));
          check.disabled = picked.length !== q.tiles!.length;
        };
        const poolButtons = shuffled(q.tiles.map((t, idx) => ({ t, idx }))).map(({ t }) => {
          const b = button("tile", t, () => {
            picked.push(t);
            b.disabled = true;
            sync();
          });
          return b;
        });
        pool.append(...poolButtons);
        const controls = el("div", "row");
        controls.appendChild(
          button("ghost", "Undo", () => {
            const last = picked.pop();
            if (last === undefined) return;
            const b = poolButtons.find((p) => p.disabled && p.textContent === last);
            if (b) b.disabled = false;
            sync();
          })
        );
        controls.appendChild(
          button("ghost", "Clear", () => {
            picked.length = 0;
            poolButtons.forEach((b) => (b.disabled = false));
            sync();
          })
        );
        controls.appendChild(el("span", "grow"));
        controls.appendChild(check);
        sync();
        card.append(answer, pool, controls);
        poolButtons[0]?.focus();
        return;
      }

      const list = el("div", "choices");
      const buttons = (q.choices || []).map((c, idx) =>
        button("choice", c, () => {
          answers[i] = idx;
          buttons.forEach((b, j) => {
            b.disabled = true;
            if (j === q.answer) b.classList.add("right");
            else if (j === idx) b.classList.add("wrong");
          });
          after();
        })
      );
      list.append(...buttons);
      card.appendChild(list);
      buttons[0]?.focus();
    };

    render();
  }

  function results(questions: QuizQuestion[], answers: QuizAnswer[]): void {
    const total = questions.length;
    const score = scoreQuiz(questions, answers);
    void trackFeature("quiz_completed");
    card.replaceChildren(top(opts.title || "Episode check"));
    const s = el("div", "score");
    s.append(el("strong", "", `${score} / ${total}`), el("span", "", verdictFor(score, total)));
    card.appendChild(s);
    card.appendChild(
      el("p", "note", score === total ? "Every question right. You followed that episode." : "Here's what slipped past:")
    );

    const missed = el("ul", "missed");
    questions.forEach((q, idx) => {
      if (isCorrect(q, answers[idx])) return;
      const li = el("li");
      li.appendChild(el("div", "", q.prompt));
      const right = q.kind === "build" ? q.quote || (q.tiles || []).join("") : (q.choices || [])[q.answer ?? 0];
      li.appendChild(el("em", "", right || ""));
      missed.appendChild(li);
    });
    if (missed.childElementCount) card.appendChild(missed);

    // Flashcards: the words they missed go into the review deck.
    const flash = el("div", "section");
    flash.hidden = true;
    const cardsRow = el("div", "row");
    cardsRow.style.marginTop = "0";
    const addBtn = button("ghost", "", () => void addMissed());
    cardsRow.appendChild(addBtn);
    flash.appendChild(cardsRow);
    let toAdd: ReturnType<typeof missedWords> = [];
    void storage.getVocab().then((vocab) => {
      toAdd = missedWords(questions, answers, vocab);
      if (!toAdd.length) {
        flash.remove();
        return;
      }
      addBtn.textContent = `Add ${toAdd.length} missed word${toAdd.length === 1 ? "" : "s"} to your reviews`;
      flash.hidden = false;
    });
    async function addMissed(): Promise<void> {
      if (!toAdd.length) return;
      addBtn.disabled = true;
      for (const w of toAdd) {
        const entry = dict.lookup(w.word);
        await storage
          .judgeWord(
            w.word,
            "learn",
            {
              reading: w.reading || entry?.reading || "",
              gloss: w.gloss || entry?.glosses?.[0] || "",
              level: entry?.level ?? 0,
              freqRank: entry?.freqRank ?? 0,
            },
            { title: opts.title, line: w.line || null, en: null }
          )
          .catch(() => {});
      }
      addBtn.textContent = `Added ${toAdd.length} to your reviews`;
    }
    card.appendChild(flash);

    card.appendChild(haruSection(questions, answers, score, total));

    const row = el("div", "row");
    row.appendChild(button("ghost", "Close", close));
    row.appendChild(el("span", "grow"));
    row.appendChild(
      button("cta", "Next episode", () => {
        const video = opts.getVideo();
        close();
        continueWatching(video);
      })
    );
    card.appendChild(row);
  }

  function haruSection(questions: QuizQuestion[], answers: QuizAnswer[], score: number, total: number): HTMLElement {
    const sec = el("div", "section");
    const words = practiceWords(questions, answers);
    const head = el("div", "haru");
    head.appendChild(el("div", "orb"));
    const body = el("div");
    body.style.flex = "1";
    head.appendChild(body);
    sec.appendChild(head);
    const title = el("h2", "", "Make it yours with Haru");
    if (!paid) title.appendChild(el("span", "pill", "Pro"));
    body.appendChild(title);
    const prompt = words.length
      ? `Write your own sentence with ${words.map((w) => `「${w}」`).join(" or ")}.`
      : "Write your own sentence with a word from this episode.";

    if (!paid) {
      body.appendChild(
        el("p", "lock", `${prompt} Haru, your tutor, judges it, fixes it, and says how you did out loud. Included with Pro and Max.`)
      );
      body.appendChild(
        button("ghost", "See Pro", () => {
          void trackPro("pro_prompt_clicked", "ext_episode_quiz");
          chrome.runtime
            .sendMessage({ type: "avc-open-url", url: `${WEB_URL}/pricing?from=ext_episode_quiz` })
            .catch(() => {});
        })
      );
      void trackPro("pro_prompt_shown", "ext_episode_quiz");
      return sec;
    }

    body.appendChild(el("p", "note", prompt));
    const input = el("textarea");
    input.maxLength = 200;
    input.lang = opts.direction === "ja-en" ? "en" : "ja";
    input.placeholder = opts.direction === "ja-en" ? "Your sentence…" : "あなたの文…";
    body.appendChild(input);
    const out = el("div");
    const send = button("cta", "Ask Haru", () => void judge());
    const row = el("div", "row");
    row.appendChild(send);
    body.append(row, out);

    async function judge(): Promise<void> {
      const sentence = input.value.trim();
      if (!sentence) return;
      send.disabled = true;
      send.textContent = "Haru is reading…";
      const res = await ask({ mode: "haru", title: opts.title || "", direction: opts.direction, sentence, words, score, total });
      send.disabled = false;
      send.textContent = "Try another";
      const haru = res.ok ? (res.data?.haru as { ok?: boolean; verdict?: string; corrected?: string; note?: string; say?: string } | undefined) : undefined;
      if (!haru?.verdict) {
        out.className = "feedback no";
        out.replaceChildren(el("div", "", res.error === "pro_required" ? "Haru is part of Pro and Max." : ERROR_COPY[res.error || ""] || "Haru couldn't answer just now."));
        return;
      }
      out.className = `feedback ${haru.ok ? "ok" : "no"}`;
      out.replaceChildren(el("b", "", haru.verdict));
      if (haru.corrected && haru.corrected !== sentence) {
        const fixed = el("div", "quote");
        const span = el("span", "", haru.corrected);
        span.lang = input.lang;
        fixed.append(span, speakButton(haru.corrected));
        out.appendChild(fixed);
      }
      if (haru.note) out.appendChild(el("div", "", haru.note));
      if (haru.say) {
        const say = el("div", "", `Haru: ${haru.say}`);
        say.lang = input.lang;
        out.appendChild(say);
        void speakText(haru.say);
      }
    }
    return sec;
  }
}
