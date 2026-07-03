/** Simple PCM fingerprint: SHA-256 of the first N seconds of downsampled mono audio. */

const FINGERPRINT_SEC = 12;
const SAMPLE_RATE = 8000;

export async function fingerprintFromAudioContext(
  ctx: AudioContext,
  stream: MediaStream
): Promise<string> {
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);

  const samples: number[] = [];
  const maxSamples = FINGERPRINT_SEC * SAMPLE_RATE;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("fingerprint timeout"));
    }, (FINGERPRINT_SEC + 3) * 1000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { proc.disconnect(); sink.disconnect(); source.disconnect(); } catch { /* noop */ }
    };

    proc.onaudioprocess = (e) => {
      const f32 = e.inputBuffer.getChannelData(0);
      const down = downsample(f32, ctx.sampleRate, SAMPLE_RATE);
      for (let i = 0; i < down.length && samples.length < maxSamples; i++) {
        samples.push(down[i]);
      }
      if (samples.length >= maxSamples) {
        cleanup();
        hashSamples(samples).then(resolve).catch(reject);
      }
    };
  });
}

function downsample(f32: Float32Array, srcRate: number, dstRate: number): Int16Array {
  const ratio = srcRate / dstRate;
  const outLen = Math.floor(f32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const s = f32[Math.floor(idx)] || 0;
    const c = Math.max(-1, Math.min(1, s));
    out[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

async function hashSamples(samples: number[]): Promise<string> {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, samples[i], true);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export { FINGERPRINT_SEC };
