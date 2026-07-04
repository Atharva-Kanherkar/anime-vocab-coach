export type SfxKind = "hover" | "click" | "transition";

let ctx: AudioContext | null = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain = 0.04,
  when = 0
) {
  const audio = getCtx();
  if (!audio) return;

  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audio.currentTime + when);
  amp.gain.setValueAtTime(gain, audio.currentTime + when);
  amp.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + when + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(audio.currentTime + when);
  osc.stop(audio.currentTime + when + duration + 0.02);
}

export function playFxSound(kind: SfxKind) {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  if (kind === "hover") {
    tone(880, 0.04, "sine", 0.025);
    return;
  }

  if (kind === "click") {
    tone(480, 0.035, "square", 0.032);
    tone(720, 0.045, "triangle", 0.026, 0.006);
    tone(1040, 0.03, "sine", 0.014, 0.012);
    return;
  }

  tone(180, 0.18, "sine", 0.05);
  tone(320, 0.22, "triangle", 0.03, 0.04);
}
