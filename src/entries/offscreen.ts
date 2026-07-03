// Offscreen document: captures tab audio for Listening Mode.
//
// BYO key: streams audio to OpenAI Realtime WebSocket (unchanged).
// Pro (hosted): uses the shared transcript cache — lookup first, transcribe
// on miss via our backend so each episode is transcribed once for all users.

const RT_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const OUT_RATE = 24000;
const CHUNK_SEC = 6;

export type SessionAuth =
  | { kind: "byo"; key: string }
  | { kind: "hosted"; licenseKey: string; backendUrl: string };

interface Session {
  ws: WebSocket | null;
  ctx: AudioContext;
  stream: MediaStream;
  proc: ScriptProcessorNode;
  sink: GainNode;
  source: MediaStreamAudioSourceNode;
  active: boolean;
  ready: boolean;
  auth: SessionAuth;
  model: string;
  tabId: number;
  srcRate: number;
  reconnects: number;
  heartbeat: ReturnType<typeof setInterval> | null;
  /** Shared cache path (Pro only). When set, audio goes to backend on miss. */
  cacheKey: string;
  playbackTime: number;
  pcmBuffer: Int16Array[];
  chunkStartSec: number;
  transcribing: boolean;
  chunkTimer: ReturnType<typeof setInterval> | null;
}

async function getWsKey(session: Session): Promise<string> {
  if (session.auth.kind === "byo") return session.auth.key;
  const res = await fetch(session.auth.backendUrl + "/v1/session", {
    method: "POST",
    headers: { Authorization: "Bearer " + session.auth.licenseKey }
  });
  const data = (await res.json().catch(() => ({}))) as {
    token?: { value: string };
    model?: string;
    error?: string;
  };
  if (res.status === 402) throw new CodedError("subscription-inactive", data.error || "subscription inactive");
  if (res.status === 429) throw new CodedError("quota-exceeded", data.error || "monthly listening hours used up");
  if (!res.ok || !data.token) throw new CodedError("capture-failed", data.error || ("backend HTTP " + res.status));
  if (data.model) session.model = data.model;
  return data.token.value;
}

class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function startHeartbeat(session: Session): void {
  if (session.auth.kind !== "hosted") return;
  const { backendUrl, licenseKey } = session.auth;
  session.heartbeat = setInterval(async () => {
    if (!session.active) return;
    try {
      const res = await fetch(backendUrl + "/v1/usage/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + licenseKey },
        body: JSON.stringify({ minutes: 5 })
      });
      if (res.status === 429) {
        olog("monthly cap reached — stopping");
        report(session.tabId, "quota-exceeded", "monthly listening hours used up");
        stop(session.tabId);
      }
    } catch (err) {
      olog("heartbeat failed (will retry):", String(err));
    }
  }, 5 * 60 * 1000);
}

const sessions: Record<number, Session> = {};

function olog(...args: unknown[]): void {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  chrome.runtime.sendMessage({ type: "avc-offscreen-log", line }).catch(() => {});
}

function report(tabId: number, code: string, detail: string): void {
  chrome.runtime.sendMessage({ type: "avc-listen-error", tabId, code, detail }).catch(() => {});
}

interface StartMsg {
  type: string;
  streamId: string;
  tabId: number;
  auth: SessionAuth;
  model: string;
  cacheKey?: string;
}

chrome.runtime.onMessage.addListener((msg: StartMsg & { type: string; time?: number; tabId?: number }, _sender, sendResponse) => {
  if (msg.type === "avc-offscreen-start") {
    olog("start received for tab", msg.tabId, "model", msg.model, "cacheKey", msg.cacheKey || "(none)");
    start(msg)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        const detail = String((err && err.message) || err);
        const code = err instanceof CodedError ? err.code : "capture-failed";
        olog("START FAILED:", detail);
        report(msg.tabId, code, detail);
        sendResponse({ ok: false, error: detail });
      });
    return true;
  }
  if (msg.type === "avc-offscreen-stop") {
    stop(msg.tabId!);
    sendResponse({ ok: true });
  }
  if (msg.type === "avc-playback-time" && msg.tabId != null) {
    const session = sessions[msg.tabId];
    if (session) session.playbackTime = Number(msg.time) || 0;
  }
});

function downsample(f32: Float32Array, srcRate: number): Int16Array {
  if (srcRate === OUT_RATE) {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const c = Math.max(-1, Math.min(1, f32[i]));
      out[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
    }
    return out;
  }
  const ratio = srcRate / OUT_RATE;
  const outLen = Math.floor(f32.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const frac = idx - i0;
    const s = (f32[i0] || 0) * (1 - frac) + (f32[i0 + 1] || 0) * frac;
    const c = Math.max(-1, Math.min(1, s));
    out[i] = c < 0 ? c * 0x8000 : c * 0x7fff;
  }
  return out;
}

function base64Int16(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  }
  return btoa(bin);
}

function concatPcm(chunks: Int16Array[]): Int16Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function lookupCache(session: Session, t: number): Promise<boolean> {
  if (session.auth.kind !== "hosted" || !session.cacheKey) return false;
  const url = new URL(session.auth.backendUrl + "/v1/transcript");
  url.searchParams.set("key", session.cacheKey);
  url.searchParams.set("t", String(t));
  const res = await fetch(url.toString(), {
    headers: { Authorization: "Bearer " + session.auth.licenseKey }
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { hit?: boolean; segments?: { text: string }[] };
  if (data.hit && data.segments?.length) {
    for (const seg of data.segments) {
      const t = (seg.text || "").trim();
      if (t && /[぀-ヿ一-鿿]/.test(t)) {
        olog("cache hit:", t);
        chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t }).catch(() => {});
      }
    }
    return true;
  }
  return false;
}

async function flushChunk(session: Session): Promise<void> {
  if (session.transcribing || !session.cacheKey || session.auth.kind !== "hosted") return;
  if (!session.pcmBuffer.length) return;

  const pcm = concatPcm(session.pcmBuffer);
  session.pcmBuffer = [];
  const startSec = session.chunkStartSec;
  session.chunkStartSec = session.playbackTime;
  session.transcribing = true;

  try {
    const hit = await lookupCache(session, startSec);
    if (hit) { session.transcribing = false; return; }

    olog("cache miss at", startSec, "— transcribing", pcm.length, "samples");
    const res = await fetch(session.auth.backendUrl + "/v1/transcript/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.auth.licenseKey
      },
      body: JSON.stringify({ key: session.cacheKey, startSec, audio: base64Int16(pcm) })
    });
    const data = (await res.json().catch(() => ({}))) as {
      segments?: { text: string }[];
      error?: string;
    };
    if (res.status === 429) {
      report(session.tabId, "quota-exceeded", data.error || "monthly listening hours used up");
      stop(session.tabId);
      return;
    }
    if (!res.ok) throw new Error(data.error || "transcribe HTTP " + res.status);
    for (const seg of data.segments || []) {
      const t = (seg.text || "").trim();
      if (t && /[぀-ヿ一-鿿]/.test(t)) {
        olog("transcribed:", t);
        chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t }).catch(() => {});
      }
    }
  } catch (err) {
    olog("chunk transcribe failed:", String(err));
  } finally {
    session.transcribing = false;
  }
}

async function start({ streamId, tabId, auth, model, cacheKey }: StartMsg): Promise<void> {
  if (sessions[tabId]) stop(tabId);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } }
    } as MediaStreamConstraints);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error("getUserMedia(tab) failed: " + detail);
  }
  olog("tab audio stream acquired, tracks:", stream.getAudioTracks().length);

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  source.connect(ctx.destination);

  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);

  const useCache = auth.kind === "hosted" && !!cacheKey;
  const session: Session = {
    ws: null, ctx, stream, proc, sink, source,
    active: true, ready: !useCache, auth, model, tabId,
    srcRate: ctx.sampleRate, reconnects: 0, heartbeat: null,
    cacheKey: cacheKey || "",
    playbackTime: 0,
    pcmBuffer: [],
    chunkStartSec: 0,
    transcribing: false,
    chunkTimer: null
  };
  sessions[tabId] = session;

  proc.onaudioprocess = (e) => {
    if (!session.active) return;
    const pcm = downsample(e.inputBuffer.getChannelData(0), session.srcRate);

    if (useCache) {
      session.pcmBuffer.push(pcm);
      return;
    }

    if (!session.ready || !session.ws || session.ws.readyState !== WebSocket.OPEN) return;
    try {
      session.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Int16(pcm) }));
    } catch { /* socket mid-close */ }
  };

  if (useCache) {
    olog("using shared transcript cache for", cacheKey);
    session.chunkTimer = setInterval(() => {
      if (session.active) flushChunk(session).catch((err) => olog("flush error:", String(err)));
    }, CHUNK_SEC * 1000);
    startHeartbeat(session);
    return;
  }

  olog("audio graph ready (src rate", session.srcRate + "Hz), connecting realtime WS");
  await connectWS(session);
  startHeartbeat(session);
}

async function connectWS(session: Session): Promise<void> {
  const wsKey = await getWsKey(session);
  let ws: WebSocket;
  try {
    ws = new WebSocket(RT_URL, ["realtime", "openai-insecure-api-key." + wsKey]);
  } catch (err) {
    olog("WebSocket ctor failed:", String(err));
    report(session.tabId, "capture-failed", String(err));
    return;
  }
  session.ws = ws;

  ws.onopen = () => olog("realtime WS open");

  ws.onmessage = (e) => {
    let msg: { type?: string; transcript?: string; error?: { message?: string } };
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === "session.created") {
      ws.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: OUT_RATE },
              transcription: { model: session.model, language: "ja" },
              turn_detection: { type: "server_vad", silence_duration_ms: 500 }
            }
          }
        }
      }));
    } else if (msg.type === "session.updated") {
      session.ready = true;
      session.reconnects = 0;
      olog("realtime session ready — streaming audio");
    } else if (msg.type === "conversation.item.input_audio_transcription.completed") {
      const t = (msg.transcript || "").trim();
      if (t && /[぀-ヿ一-鿿]/.test(t)) {
        olog("transcript:", t);
        chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t }).catch(() => {});
      }
    } else if (msg.type === "error") {
      const detail = (msg.error && msg.error.message) || JSON.stringify(msg);
      olog("realtime error:", String(detail).slice(0, 300));
      if (/api key|invalid_?api|unauthor|authentication/i.test(detail)) {
        report(session.tabId, "invalid-key", detail);
        stop(session.tabId);
      }
    }
  };

  ws.onerror = () => olog("realtime WS error event");

  ws.onclose = (ev) => {
    olog("realtime WS closed:", ev.code, ev.reason || "");
    session.ready = false;
    if (session.active && session.reconnects < 3 && ev.code !== 4001) {
      session.reconnects += 1;
      setTimeout(() => {
        if (session.active) {
          connectWS(session).catch((err) => {
            const code = err instanceof CodedError ? err.code : "capture-failed";
            report(session.tabId, code, String(err && err.message || err));
            stop(session.tabId);
          });
        }
      }, 1500);
    }
  };
}

function stop(tabId: number): void {
  const session = sessions[tabId];
  if (!session) return;
  session.active = false;
  if (session.heartbeat) clearInterval(session.heartbeat);
  if (session.chunkTimer) clearInterval(session.chunkTimer);
  if (session.cacheKey && session.pcmBuffer.length) {
    flushChunk(session).catch(() => {});
  }
  try { if (session.ws && session.ws.readyState <= 1) session.ws.close(); } catch { /* noop */ }
  try { session.proc.disconnect(); session.sink.disconnect(); session.source.disconnect(); } catch { /* noop */ }
  try { session.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
  session.ctx.close().catch(() => {});
  delete sessions[tabId];
  olog("stopped tab", tabId);
}
