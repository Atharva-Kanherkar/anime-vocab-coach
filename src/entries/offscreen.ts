// Offscreen document: captures tab audio for Listening Mode.
//
// BYO key: streams audio to OpenAI Realtime WebSocket.
// Cloud (signed in): shared transcript cache — lookup first, transcribe on miss.

import { CueLedger } from "../lib/cue-ledger";

const RT_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const OUT_RATE = 24000;
const CHUNK_SEC = 6;
const SEEK_THRESHOLD_SEC = 2;
const MIN_PCM_SAMPLES = OUT_RATE; // ~1s minimum before transcribing

export type SessionAuth =
  | { kind: "byo"; key: string }
  | { kind: "cloud"; syncToken: string; backendUrl: string };

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
  language: string;
  tabId: number;
  srcRate: number;
  reconnects: number;
  heartbeat: ReturnType<typeof setInterval> | null;
  cacheKey: string;
  playbackTime: number;
  playbackPaused: boolean;
  pcmBuffer: Int16Array[];
  chunkStartSec: number;
  chunkStarted: boolean;
  transcribing: boolean;
  chunkTimer: ReturnType<typeof setInterval> | null;
  useCache: boolean;
  /** Segments already forwarded to the tab. Warm-cache hits return a window
   * wider than one chunk, so consecutive 6s chunks overlap — without this the
   * same line is fanned out (and carded) more than once. */
  sentCues: CueLedger;
  /** Start of the current unpaused stretch on the realtime path, or null while
   * paused/stopped. */
  billedFromMs: number | null;
  /** Unpaused milliseconds accrued but not yet reported to the backend. */
  pendingBillMs: number;
  /** Bumped on every mode change so work resumed after an await can tell that
   * the session moved on while it was suspended. */
  modeGeneration: number;
}

async function getWsKey(session: Session): Promise<string> {
  if (session.auth.kind === "byo") return session.auth.key;
  const res = await fetch(session.auth.backendUrl + "/v1/session", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + session.auth.syncToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ language: session.language || "ja" })
  });
  const data = (await res.json().catch(() => ({}))) as {
    token?: { value: string };
    model?: string;
    error?: string;
  };
  if (res.status === 401) throw new CodedError("not-signed-in", data.error || "sign in at animevocab.com");
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

/**
 * Wall-clock meter for the realtime-WS path ONLY. There, audio goes straight to
 * OpenAI and the backend never sees a minute of it, so the heartbeat is the only
 * way to bill listening.
 *
 * The cached path must NOT call this: /v1/transcript/transcribe already charges
 * the real audio duration of every chunk it transcribes. Running both billed the
 * same playback twice (5 min/tick of wall clock PLUS ~5 min of chunk audio per
 * 5 min watched), so an "8 hour" free month died at ~4 hours — and cache hits,
 * which cost the business nothing, still burned quota.
 */
/** Below this, a flush isn't worth a request — the time stays accrued and rides
 * along with the next one. A final flush ignores it so nothing is dropped. */
const MIN_FLUSH_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/** Move elapsed unpaused time into the pending bill. Safe to call repeatedly. */
function accrueListening(session: Session, now = Date.now()): void {
  if (session.billedFromMs == null) return;
  const delta = now - session.billedFromMs;
  if (delta > 0) session.pendingBillMs += delta;
  session.billedFromMs = now;
}

/**
 * Start or stop the realtime billing clock. Charging was previously decided by
 * sampling `playbackPaused` at the tick boundary and then billing a flat five
 * minutes, so playing 4:59 and pausing cost nothing while resuming a second
 * before a tick cost a full five minutes. Time is now measured, not sampled.
 */
function setListeningClock(session: Session, playing: boolean): void {
  if (session.auth.kind !== "cloud" || session.useCache) {
    // Cached path bills per transcribed chunk; nothing to accrue here.
    session.billedFromMs = null;
    return;
  }
  if (playing) {
    if (session.billedFromMs == null) session.billedFromMs = Date.now();
    return;
  }
  accrueListening(session);
  session.billedFromMs = null;
}

/** Report accrued time. `final` forces a flush of whatever is left (stop, or a
 * switch to the cached path) so partial intervals aren't discarded. */
async function flushListening(session: Session, final = false): Promise<void> {
  if (session.auth.kind !== "cloud") return;
  accrueListening(session);
  if (session.pendingBillMs <= 0) return;
  if (!final && session.pendingBillMs < MIN_FLUSH_MS) return;

  const { backendUrl, syncToken } = session.auth;
  // The backend clamps a single report to 10 minutes; anything above that stays
  // pending and goes out on the next flush.
  const minutes = Math.min(10, session.pendingBillMs / 60_000);
  const sentMs = minutes * 60_000;
  session.pendingBillMs = Math.max(0, session.pendingBillMs - sentMs);

  try {
    const res = await fetch(backendUrl + "/v1/usage/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + syncToken },
      body: JSON.stringify({ minutes })
    });
    if (res.status === 429) {
      olog("monthly cap reached — stopping");
      report(session.tabId, "quota-exceeded", "monthly listening hours used up");
      stop(session.tabId);
    }
  } catch (err) {
    // Put the time back so a transient failure doesn't hand out free minutes.
    session.pendingBillMs += sentMs;
    olog("heartbeat failed (will retry):", String(err));
  }
}

/**
 * Wall-clock meter for the realtime-WS path ONLY. There, audio goes straight to
 * OpenAI and the backend never sees a minute of it, so this is the only way to
 * bill listening.
 *
 * The cached path must NOT call this: /v1/transcript/transcribe already charges
 * the real audio duration of every chunk it transcribes. Running both billed the
 * same playback twice (5 min/tick of wall clock PLUS ~5 min of chunk audio per
 * 5 min watched), so an "8 hour" free month died at ~4 hours — and cache hits,
 * which cost the business nothing, still burned quota.
 */
function startHeartbeat(session: Session): void {
  if (session.auth.kind !== "cloud") return;
  if (session.useCache) return;
  if (session.heartbeat) return;
  setListeningClock(session, session.active && !session.playbackPaused);
  session.heartbeat = setInterval(() => {
    void flushListening(session);
  }, HEARTBEAT_INTERVAL_MS);
}

/** Tear the realtime socket down without tripping the reconnect path in
 * `onclose` (which only checks `session.active`). */
function closeRealtimeSocket(session: Session): void {
  const ws = session.ws;
  if (!ws) return;
  session.ws = null;
  session.ready = false;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  try { if (ws.readyState <= 1) ws.close(); } catch { /* already closing */ }
}

/**
 * Point the session's timers at whichever mode it is currently in. Called at
 * start and again whenever the cache key arrives or changes mid-session.
 *
 * The cache key often resolves a beat after Listening starts (the background
 * logs "no cache key yet"), which used to flip `useCache` to true while the
 * chunk timer had never been created: `onaudioprocess` stopped feeding the
 * WebSocket and started buffering PCM that nothing ever flushed, so Listening
 * Mode went silent while the heartbeat kept billing 5 min/tick.
 */
function applyCacheMode(session: Session): void {
  // Any in-flight work that resumes after this point belongs to the old mode.
  session.modeGeneration += 1;
  if (session.useCache) {
    if (session.heartbeat) {
      clearInterval(session.heartbeat);
      session.heartbeat = null;
    }
    // Bank whatever realtime time was watched before the switch — dropping the
    // partial interval here was a small silent giveaway on every mode flip.
    void flushListening(session, true);
    session.billedFromMs = null;
    closeRealtimeSocket(session);
    if (!session.chunkTimer) {
      session.chunkTimer = setInterval(() => {
        if (session.active) flushChunk(session).catch((err) => olog("flush error:", String(err)));
      }, CHUNK_SEC * 1000);
    }
    return;
  }
  if (session.chunkTimer) {
    clearInterval(session.chunkTimer);
    session.chunkTimer = null;
  }
  // Losing the key sends this session back to the realtime socket; reconnect if
  // cached mode had closed it, otherwise there is nowhere for audio to go.
  if (!session.ws && session.active) {
    connectWS(session).catch((err) => olog("reconnect after cache-key loss failed:", String(err)));
  }
  startHeartbeat(session);
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
  language?: string;
  cacheKey?: string;
}

interface PlaybackMsg {
  type: string;
  tabId?: number;
  time?: number;
  paused?: boolean;
}

function resetAudioBuffer(session: Session, atSec?: number): void {
  session.pcmBuffer = [];
  session.chunkStarted = false;
  session.chunkStartSec = atSec ?? session.playbackTime;
}

function onPlaybackUpdate(session: Session, time: number, paused: boolean): void {
  const prev = session.playbackTime;
  const wasPaused = session.playbackPaused;
  session.playbackTime = time;
  session.playbackPaused = paused;
  // Bank the stretch that just ended (or open a new one) the moment playback
  // state actually flips, so billing tracks real watched time rather than
  // whatever the state happened to be when a timer fired.
  if (paused !== wasPaused) setListeningClock(session, !paused);
  if (Math.abs(time - prev) > SEEK_THRESHOLD_SEC) {
    olog("playback seek detected", prev, "→", time, "— resetting audio buffer");
    resetAudioBuffer(session, time);
  }
}

chrome.runtime.onMessage.addListener((msg: StartMsg & PlaybackMsg, _sender, sendResponse) => {
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
  if (msg.type === "avc-offscreen-update-key" && msg.tabId != null) {
    const session = sessions[msg.tabId];
    if (session) {
      const newKey = msg.cacheKey || "";
      if (newKey !== session.cacheKey) {
        session.cacheKey = newKey;
        session.useCache = session.auth.kind === "cloud" && !!newKey;
        // Cue timestamps repeat from zero in every episode. Retaining the old
        // episode's ledger can suppress an identical opening line in the next.
        session.sentCues.clear();
        // Drop any buffered audio from the previous episode so nothing is
        // uploaded under the old key.
        resetAudioBuffer(session);
        // A key arriving (or disappearing) switches which pipeline — and which
        // meter — this session runs on. Without this the timers stayed on the
        // old mode.
        applyCacheMode(session);
        olog("cache key updated for tab", msg.tabId, "→", newKey || "(none)");
      }
    }
    sendResponse({ ok: true });
  }
  if (msg.type === "avc-playback-time" && msg.tabId != null) {
    const session = sessions[msg.tabId];
    if (session) onPlaybackUpdate(session, Number(msg.time) || 0, !!msg.paused);
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

function pcmSampleCount(chunks: Int16Array[]): number {
  return chunks.reduce((n, c) => n + c.length, 0);
}

async function flushChunk(session: Session): Promise<void> {
  if (session.transcribing || !session.cacheKey || session.auth.kind !== "cloud") return;
  if (session.playbackPaused) return;
  if (!session.chunkStarted || pcmSampleCount(session.pcmBuffer) < MIN_PCM_SAMPLES) return;

  const pcm = concatPcm(session.pcmBuffer);
  resetAudioBuffer(session);
  const startSec = session.chunkStartSec;
  const requestKey = session.cacheKey;
  const generation = session.modeGeneration;
  session.transcribing = true;

  try {
    olog("transcribing chunk at playback", startSec, "samples", pcm.length);
    const res = await fetch(session.auth.backendUrl + "/v1/transcript/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.auth.syncToken
      },
      body: JSON.stringify({ key: requestKey, startSec, audio: base64Int16(pcm) })
    });
    const data = (await res.json().catch(() => ({}))) as {
      hit?: boolean;
      segments?: { start?: number; text: string }[];
      error?: string;
    };
    // A cache-key or mode change clears sentCues. Discard the old response so it
    // cannot refill that ledger, emit stale dialogue, or stop the new session.
    if (!session.active || session.cacheKey !== requestKey || session.modeGeneration !== generation) return;
    if (res.status === 429) {
      report(session.tabId, "quota-exceeded", data.error || "monthly listening hours used up");
      stop(session.tabId);
      return;
    }
    if (!res.ok) throw new Error(data.error || "transcribe HTTP " + res.status);
    for (const seg of data.segments || []) {
      const t = (seg.text || "").trim();
      const langOk = session.language === "en"
        ? /[A-Za-z]{2,}/.test(t)
        : /[\u3040-\u30FF\u4E00-\u9FFF]/.test(t);
      if (t && langOk) {
        const cue = `${seg.start ?? "?"}:${t}`;
        if (!session.sentCues.remember(cue)) continue;
        olog(data.hit ? "cache hit:" : "transcribed:", t);
        chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t, start: seg.start }).catch(() => {});
      }
    }
  } catch (err) {
    olog("chunk transcribe failed:", String(err));
  } finally {
    session.transcribing = false;
  }
}

async function start({ streamId, tabId, auth, model, language, cacheKey }: StartMsg): Promise<void> {
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

  const useCache = auth.kind === "cloud" && !!cacheKey;
  const session: Session = {
    ws: null, ctx, stream, proc, sink, source,
    active: true, ready: false, auth, model, language: language === "en" ? "en" : "ja", tabId,
    srcRate: ctx.sampleRate, reconnects: 0, heartbeat: null,
    cacheKey: cacheKey || "",
    playbackTime: 0,
    // Assume PLAYING until a playback relay says otherwise. A session only
    // starts on a playing video, and the content→background→offscreen relay
    // that flips this can silently fail to land — when it did, this stayed
    // `true` forever and gated ALL audio off (proc.onaudioprocess + flushChunk),
    // so nothing was ever transcribed and no words appeared. Defaulting to
    // playing makes audio flow immediately; the relay still pauses it when it
    // works. Better to over-capture briefly than to transcribe nothing.
    playbackPaused: false,
    pcmBuffer: [],
    chunkStartSec: 0,
    chunkStarted: false,
    transcribing: false,
    chunkTimer: null,
    useCache,
    sentCues: new CueLedger(),
    billedFromMs: null,
    pendingBillMs: 0,
    modeGeneration: 0
  };
  sessions[tabId] = session;

  proc.onaudioprocess = (e) => {
    if (!session.active || session.playbackPaused) return;
    const pcm = downsample(e.inputBuffer.getChannelData(0), session.srcRate);

    if (session.useCache) {
      if (!session.chunkStarted) {
        session.chunkStarted = true;
        session.chunkStartSec = session.playbackTime;
      }
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
    applyCacheMode(session);
    return;
  }

  olog("audio graph ready (src rate", session.srcRate + "Hz), connecting realtime WS");
  await connectWS(session);
  applyCacheMode(session);
}

async function connectWS(session: Session): Promise<void> {
  // getWsKey() is a network round-trip. A cache key can arrive while it's in
  // flight, which flips the session to the cached pipeline — opening the socket
  // afterwards left a stray realtime connection whose later errors or reconnect
  // attempts could stop a perfectly healthy cached session.
  const generation = session.modeGeneration;
  const stale = (): boolean =>
    !session.active || session.useCache || session.modeGeneration !== generation;

  const wsKey = await getWsKey(session);
  if (stale()) {
    olog("dropping realtime connect — session switched modes while authorizing");
    return;
  }
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
              transcription: { model: session.model, language: session.language || "ja" },
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
      const langOk = session.language === "en"
        ? /[A-Za-z]{2,}/.test(t)
        : /[\u3040-\u30FF\u4E00-\u9FFF]/.test(t);
      if (t && langOk) {
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
    // Expected close — we tore the socket down in stop(). Nothing to do.
    if (!session.active) return;

    if (ev.code !== 4001 && session.reconnects < 3) {
      session.reconnects += 1;
      setTimeout(() => {
        // Don't resurrect the socket if the session moved to the cached
        // pipeline during the backoff.
        if (session.active && !session.useCache) {
          connectWS(session).catch((err) => {
            const code = err instanceof CodedError ? err.code : "capture-failed";
            report(session.tabId, code, String(err && err.message || err));
            stop(session.tabId);
          });
        }
      }, 1500);
      return;
    }

    // Out of reconnects (or a terminal close). The old code silently gave up
    // here: the session stayed "active" so the heartbeat kept billing and the
    // REC badge stayed lit while nothing was being transcribed (P1). Stop the
    // session — which clears the heartbeat + badge — and tell the user.
    report(session.tabId, "connection-lost", "lost connection to the transcription service");
    stop(session.tabId);
  };
}

function stop(tabId: number): void {
  const session = sessions[tabId];
  if (!session) return;
  session.active = false;
  // Last chance to report the tail of the current stretch. Fire-and-forget: the
  // offscreen document may be torn down right after this, and a dropped final
  // report only ever under-bills.
  setListeningClock(session, false);
  void flushListening(session, true);
  if (session.heartbeat) clearInterval(session.heartbeat);
  if (session.chunkTimer) clearInterval(session.chunkTimer);
  if (session.useCache && session.pcmBuffer.length && !session.playbackPaused) {
    flushChunk(session).catch(() => {});
  }
  try { if (session.ws && session.ws.readyState <= 1) session.ws.close(); } catch { /* noop */ }
  try { session.proc.disconnect(); session.sink.disconnect(); session.source.disconnect(); } catch { /* noop */ }
  try { session.stream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
  session.ctx.close().catch(() => {});
  delete sessions[tabId];
  olog("stopped tab", tabId);
}
