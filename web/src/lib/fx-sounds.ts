export type SfxKind = "hover" | "click" | "transition";

let ctx: AudioContext | null = null;
let unlocked = false;
const audioPool = new Map<SfxKind, HTMLAudioElement>();

function getAudio(kind: SfxKind): HTMLAudioElement {
  let el = audioPool.get(kind);
  if (!el) {
    const src =
      kind === "click"
        ? "/sfx/click.wav"
        : kind === "transition"
          ? "/sfx/transition.wav"
          : "/sfx/click.wav";
    el = new Audio(src);
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    el.volume = kind === "click" ? 0.75 : 0.45;
    audioPool.set(kind, el);
  }
  return el;
}

/** Run synchronously inside a user-gesture handler to unlock audio for scroll SFX. */
export function primeFxAudio(): void {
  if (typeof window === "undefined" || unlocked) return;

  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx && !ctx) ctx = new Ctx();
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {
    /* HTMLAudio fallback below */
  }

  const el = getAudio("click");
  const restoreVol = el.volume;
  el.volume = 0.001;
  const attempt = el.play();
  if (!attempt) {
    el.volume = restoreVol;
    unlocked = true;
    return;
  }
  attempt
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = restoreVol;
      unlocked = true;
    })
    .catch(() => {
      el.volume = restoreVol;
    });
}

export function playFxSound(kind: SfxKind): void {
  if (typeof window === "undefined") return;

  const base = getAudio(kind);
  const node = base.cloneNode() as HTMLAudioElement;
  node.volume = base.volume;
  node.setAttribute("playsinline", "");
  void node.play().catch(() => {
    if (!ctx) {
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) ctx = new Ctx();
      } catch {
        return;
      }
    }
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().then(() => playWebKind(ctx!, kind));
    else if (ctx.state === "running") playWebKind(ctx, kind);
  });
}

function tone(
  audio: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain = 0.1,
  when = 0
) {
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audio.currentTime + when);
  amp.gain.setValueAtTime(Math.max(gain, 0.0001), audio.currentTime + when);
  amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + when + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(audio.currentTime + when);
  osc.stop(audio.currentTime + when + duration + 0.02);
}

function playWebKind(audio: AudioContext, kind: SfxKind) {
  if (kind === "click") {
    tone(audio, 520, 0.04, "square", 0.12);
    tone(audio, 780, 0.05, "triangle", 0.08, 0.006);
    tone(audio, 1180, 0.035, "sine", 0.05, 0.012);
    return;
  }
  if (kind === "transition") {
    tone(audio, 180, 0.18, "sine", 0.08);
    tone(audio, 320, 0.22, "triangle", 0.06, 0.04);
    return;
  }
  tone(audio, 880, 0.04, "sine", 0.05);
}
