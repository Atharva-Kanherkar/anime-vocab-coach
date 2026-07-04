export type SfxKind = "hover" | "click" | "transition";

let ctx: AudioContext | null = null;
let unlockPromise: Promise<AudioContext | null> | null = null;

/** Call on pointer / key / wheel so scroll-triggered sounds are allowed. */
export function unlockFxAudio(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (ctx?.state === "running") return Promise.resolve(ctx);

  if (!unlockPromise) {
    unlockPromise = (async () => {
      if (!ctx) ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      return ctx.state === "running" ? ctx : null;
    })().finally(() => {
      unlockPromise = null;
    });
  }

  return unlockPromise;
}

function tone(
  audio: AudioContext,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain = 0.08,
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

function playKind(audio: AudioContext, kind: SfxKind) {
  if (kind === "hover") {
    tone(audio, 880, 0.04, "sine", 0.04);
    return;
  }

  if (kind === "click") {
    tone(audio, 520, 0.04, "square", 0.1);
    tone(audio, 780, 0.05, "triangle", 0.07, 0.006);
    tone(audio, 1180, 0.035, "sine", 0.045, 0.012);
    return;
  }

  tone(audio, 180, 0.18, "sine", 0.07);
  tone(audio, 320, 0.22, "triangle", 0.05, 0.04);
}

export async function playFxSound(kind: SfxKind): Promise<void> {
  const audio = await unlockFxAudio();
  if (!audio) return;
  playKind(audio, kind);
}
