// Watches the episode for the content script: notes the lines it hands to the
// learning pipeline (subtitle Learn and Listening Mode alike), counts real
// playback, and offers the quiz once when the episode ends.

import * as storage from "./storage";
import { trackFeature } from "./feature-events";
import { log } from "./log";
import {
  EpisodeLog,
  getQuizPrefs,
  isEpisodeEnding,
  knownWordsIn,
  markQuizAsked,
  setQuizOff,
  shouldOfferQuiz,
} from "./episode-quiz";
import { closeQuiz, hideQuizNudge, isQuizNudgeUp, isQuizOpen, openQuiz, showQuizNudge } from "./episode-quiz-ui";

const TICK_MS = 1000;
/** A tick longer than this (a throttled background tab) counts as this much. */
const MAX_TICK_SEC = 2;

export interface EpisodeQuizDeps {
  getVideo: () => HTMLVideoElement | null;
  /** The video on screen now; a change starts a new episode log. */
  sessionId: () => string;
  title: () => string | null;
  /** Signed in and the pipeline is allowed to run (#206). */
  active: () => boolean;
  /** Following an N5 lesson: the course has its own checkpoint. */
  inCourse: () => boolean;
  direction: () => "en-ja" | "ja-en";
  /** The quiz is opening over the player: clear other in-player surfaces. */
  onOpen: () => void;
}

export interface EpisodeQuiz {
  noteLine(text: string, en?: string): void;
  stop(): void;
}

export function createEpisodeQuiz(deps: EpisodeQuizDeps): EpisodeQuiz {
  const episode = new EpisodeLog();
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastTick = 0;
  let prefs: { off: boolean; asked: string[] } | null = null;
  let prefsLoading = false;
  /** Offered on this page, whatever storage says. */
  const offered = new Set<string>();

  function loadPrefs(): void {
    if (prefs || prefsLoading) return;
    prefsLoading = true;
    void getQuizPrefs().then((p) => {
      prefs = p;
      prefsLoading = false;
    });
  }

  function follow(): void {
    const key = deps.sessionId();
    if (key !== episode.session) {
      episode.use(key);
      // The next episode autoplayed under an unanswered nudge.
      if (isQuizNudgeUp()) hideQuizNudge();
    }
  }

  function tick(): void {
    const now = Date.now();
    const elapsed = lastTick ? Math.min(MAX_TICK_SEC, (now - lastTick) / 1000) : 0;
    lastTick = now;
    if (!deps.active()) return;
    const video = deps.getVideo();
    if (!video) return;
    follow();
    if (!video.paused && !video.ended) episode.playedSec += elapsed;
    if (!prefs || isQuizOpen() || isQuizNudgeUp()) return;

    const key = episode.session;
    const offer = shouldOfferQuiz({
      optedOut: prefs.off,
      asked: offered.has(key) || prefs.asked.includes(key),
      inCourse: deps.inCourse(),
      lines: episode.size,
      playedSec: episode.playedSec,
      ending: isEpisodeEnding(video),
    });
    if (!offer) return;

    offered.add(key);
    void markQuizAsked(key);
    void trackFeature("quiz_offered");
    log("episode quiz offered:", key, episode.size, "lines");
    showQuizNudge({
      onStart: () => void start(),
      onLater: () => {},
      onOff: () => {
        if (prefs) prefs.off = true;
        void setQuizOff();
      },
    });
  }

  async function start(): Promise<void> {
    const video = deps.getVideo();
    video?.pause();
    deps.onOpen();
    const lines = episode.sample();
    const [profile, vocab] = await Promise.all([
      storage.getSyncProfile().catch(() => null),
      storage.getVocab().catch(() => ({})),
    ]);
    openQuiz({
      title: deps.title(),
      direction: deps.direction(),
      lines,
      known: knownWordsIn(lines, vocab),
      plan: profile?.plan === "pro" || profile?.plan === "max" ? profile.plan : "free",
      getVideo: deps.getVideo,
    });
  }

  return {
    noteLine(text, en = "") {
      if (!deps.active()) return;
      loadPrefs();
      follow();
      episode.add(text, en);
      if (!timer) {
        lastTick = Date.now();
        timer = setInterval(tick, TICK_MS);
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      lastTick = 0;
      hideQuizNudge();
      closeQuiz();
    },
  };
}
