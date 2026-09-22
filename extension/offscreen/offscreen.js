"use strict";
(() => {
  // src/lib/cue-ledger.ts
  var MAX_TRACKED_CUES = 2e3;
  var CueLedger = class {
    constructor(capacity = MAX_TRACKED_CUES) {
      this.capacity = capacity;
      this.seen = /* @__PURE__ */ new Set();
      this.order = [];
      this.head = 0;
      if (!Number.isInteger(capacity) || capacity < 1) {
        throw new Error("cue ledger capacity must be a positive integer");
      }
    }
    /** Returns true only the first time a cue is remembered while retained. */
    remember(key) {
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      this.order.push(key);
      if (this.seen.size > this.capacity) {
        const oldest = this.order[this.head++];
        this.seen.delete(oldest);
        if (this.head >= 1024 && this.head * 2 >= this.order.length) {
          this.order = this.order.slice(this.head);
          this.head = 0;
        }
      }
      return true;
    }
    clear() {
      this.seen.clear();
      this.order = [];
      this.head = 0;
    }
    get size() {
      return this.seen.size;
    }
  };

  // src/entries/offscreen.ts
  var RT_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
  var OUT_RATE = 24e3;
  var CHUNK_SEC = 6;
  var SEEK_THRESHOLD_SEC = 2;
  var MIN_PCM_SAMPLES = OUT_RATE;
  async function getWsKey(session) {
    if (session.auth.kind === "byo") return session.auth.key;
    const res = await fetch(session.auth.backendUrl + "/v1/session", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + session.auth.syncToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ language: session.language || "ja" })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new CodedError("not-signed-in", data.error || "sign in at animevocab.com");
    if (res.status === 429) throw new CodedError("quota-exceeded", data.error || "monthly listening hours used up");
    if (!res.ok || !data.token) throw new CodedError("capture-failed", data.error || "backend HTTP " + res.status);
    if (data.model) session.model = data.model;
    return data.token.value;
  }
  var CodedError = class extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  };
  var MIN_FLUSH_MS = 3e4;
  var HEARTBEAT_INTERVAL_MS = 5 * 60 * 1e3;
  function accrueListening(session, now = Date.now()) {
    if (session.billedFromMs == null) return;
    const delta = now - session.billedFromMs;
    if (delta > 0) session.pendingBillMs += delta;
    session.billedFromMs = now;
  }
  function setListeningClock(session, playing) {
    if (session.auth.kind !== "cloud" || session.useCache) {
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
  async function flushListening(session, final = false) {
    if (session.auth.kind !== "cloud") return;
    accrueListening(session);
    if (session.pendingBillMs <= 0) return;
    if (!final && session.pendingBillMs < MIN_FLUSH_MS) return;
    const { backendUrl, syncToken } = session.auth;
    const minutes = Math.min(10, session.pendingBillMs / 6e4);
    const sentMs = minutes * 6e4;
    session.pendingBillMs = Math.max(0, session.pendingBillMs - sentMs);
    try {
      const res = await fetch(backendUrl + "/v1/usage/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + syncToken },
        body: JSON.stringify({ minutes })
      });
      if (res.status === 429) {
        olog("monthly cap reached \u2014 stopping");
        report(session.tabId, "quota-exceeded", "monthly listening hours used up");
        stop(session.tabId);
      }
    } catch (err) {
      session.pendingBillMs += sentMs;
      olog("heartbeat failed (will retry):", String(err));
    }
  }
  function startHeartbeat(session) {
    if (session.auth.kind !== "cloud") return;
    if (session.useCache) return;
    if (session.heartbeat) return;
    setListeningClock(session, session.active && !session.playbackPaused);
    session.heartbeat = setInterval(() => {
      void flushListening(session);
    }, HEARTBEAT_INTERVAL_MS);
  }
  function closeRealtimeSocket(session) {
    const ws = session.ws;
    if (!ws) return;
    session.ws = null;
    session.ready = false;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      if (ws.readyState <= 1) ws.close();
    } catch {
    }
  }
  function applyCacheMode(session) {
    session.modeGeneration += 1;
    if (session.useCache) {
      if (session.heartbeat) {
        clearInterval(session.heartbeat);
        session.heartbeat = null;
      }
      void flushListening(session, true);
      session.billedFromMs = null;
      closeRealtimeSocket(session);
      if (!session.chunkTimer) {
        session.chunkTimer = setInterval(() => {
          if (session.active) flushChunk(session).catch((err) => olog("flush error:", String(err)));
        }, CHUNK_SEC * 1e3);
      }
      return;
    }
    if (session.chunkTimer) {
      clearInterval(session.chunkTimer);
      session.chunkTimer = null;
    }
    if (!session.ws && session.active) {
      connectWS(session).catch((err) => olog("reconnect after cache-key loss failed:", String(err)));
    }
    startHeartbeat(session);
  }
  var sessions = {};
  function olog(...args) {
    const line = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ");
    chrome.runtime.sendMessage({ type: "avc-offscreen-log", line }).catch(() => {
    });
  }
  function report(tabId, code, detail) {
    chrome.runtime.sendMessage({ type: "avc-listen-error", tabId, code, detail }).catch(() => {
    });
  }
  function resetAudioBuffer(session, atSec) {
    session.pcmBuffer = [];
    session.chunkStarted = false;
    session.chunkStartSec = atSec ?? session.playbackTime;
  }
  function onPlaybackUpdate(session, time, paused) {
    const prev = session.playbackTime;
    const wasPaused = session.playbackPaused;
    session.playbackTime = time;
    session.playbackPaused = paused;
    if (paused !== wasPaused) setListeningClock(session, !paused);
    if (Math.abs(time - prev) > SEEK_THRESHOLD_SEC) {
      olog("playback seek detected", prev, "\u2192", time, "\u2014 resetting audio buffer");
      resetAudioBuffer(session, time);
    }
  }
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "avc-offscreen-start") {
      olog("start received for tab", msg.tabId, "model", msg.model, "cacheKey", msg.cacheKey || "(none)");
      start(msg).then(() => sendResponse({ ok: true })).catch((err) => {
        const detail = String(err && err.message || err);
        const code = err instanceof CodedError ? err.code : "capture-failed";
        olog("START FAILED:", detail);
        stop(msg.tabId);
        report(msg.tabId, code, detail);
        sendResponse({ ok: false, error: detail });
      });
      return true;
    }
    if (msg.type === "avc-offscreen-stop") {
      stop(msg.tabId);
      sendResponse({ ok: true });
    }
    if (msg.type === "avc-offscreen-update-key" && msg.tabId != null) {
      const session = sessions[msg.tabId];
      if (session) {
        const newKey = msg.cacheKey || "";
        if (newKey !== session.cacheKey) {
          session.cacheKey = newKey;
          session.useCache = session.auth.kind === "cloud" && !!newKey;
          session.sentCues.clear();
          resetAudioBuffer(session);
          applyCacheMode(session);
          olog("cache key updated for tab", msg.tabId, "\u2192", newKey || "(none)");
        }
      }
      sendResponse({ ok: true });
    }
    if (msg.type === "avc-playback-time" && msg.tabId != null) {
      const session = sessions[msg.tabId];
      if (session) onPlaybackUpdate(session, Number(msg.time) || 0, !!msg.paused);
    }
  });
  function downsample(f32, srcRate) {
    if (srcRate === OUT_RATE) {
      const out2 = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const c = Math.max(-1, Math.min(1, f32[i]));
        out2[i] = c < 0 ? c * 32768 : c * 32767;
      }
      return out2;
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
      out[i] = c < 0 ? c * 32768 : c * 32767;
    }
    return out;
  }
  function base64Int16(int16) {
    const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
    let bin = "";
    const CH = 32768;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
    }
    return btoa(bin);
  }
  function concatPcm(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Int16Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
  function pcmSampleCount(chunks) {
    return chunks.reduce((n, c) => n + c.length, 0);
  }
  async function flushChunk(session) {
    if (session.transcribingGeneration === session.modeGeneration) {
      session.flushDeferred = true;
      return;
    }
    if (!session.cacheKey || session.auth.kind !== "cloud") return;
    if (session.playbackPaused) return;
    if (!session.chunkStarted || pcmSampleCount(session.pcmBuffer) < MIN_PCM_SAMPLES) return;
    const pcm = concatPcm(session.pcmBuffer);
    resetAudioBuffer(session);
    const startSec = session.chunkStartSec;
    const requestKey = session.cacheKey;
    const generation = session.modeGeneration;
    session.transcribingGeneration = generation;
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
      const data = await res.json().catch(() => ({}));
      if (!session.active || session.cacheKey !== requestKey || session.modeGeneration !== generation) return;
      if (res.status === 429) {
        report(session.tabId, "quota-exceeded", data.error || "monthly listening hours used up");
        stop(session.tabId);
        return;
      }
      if (!res.ok) throw new Error(data.error || "transcribe HTTP " + res.status);
      for (const seg of data.segments || []) {
        const t = (seg.text || "").trim();
        const langOk = session.language === "en" ? /[A-Za-z]{2,}/.test(t) : /[\u3040-\u30FF\u4E00-\u9FFF]/.test(t);
        if (t && langOk) {
          const cue = `${seg.start ?? "?"}:${t}`;
          if (!session.sentCues.remember(cue)) continue;
          olog(data.hit ? "cache hit:" : "transcribed:", t);
          chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t, start: seg.start, end: seg.end }).catch(() => {
          });
        }
      }
    } catch (err) {
      olog("chunk transcribe failed:", String(err));
    } finally {
      if (session.transcribingGeneration === generation) {
        session.transcribingGeneration = null;
        if (session.flushDeferred && session.active && session.modeGeneration === generation) {
          session.flushDeferred = false;
          flushChunk(session).catch((err) => olog("flush error:", String(err)));
        }
      }
    }
  }
  async function start({ streamId, tabId, auth, model, language, cacheKey }) {
    if (sessions[tabId]) stop(tabId);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } }
      });
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
    const session = {
      ws: null,
      ctx,
      stream,
      proc,
      sink,
      source,
      active: true,
      ready: false,
      auth,
      model,
      language: language === "en" ? "en" : "ja",
      tabId,
      srcRate: ctx.sampleRate,
      reconnects: 0,
      heartbeat: null,
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
      transcribingGeneration: null,
      chunkTimer: null,
      useCache,
      sentCues: new CueLedger(),
      billedFromMs: null,
      pendingBillMs: 0,
      modeGeneration: 0,
      flushDeferred: false,
      speechTimes: /* @__PURE__ */ new Map()
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
      } catch {
      }
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
  async function connectWS(session) {
    const generation = session.modeGeneration;
    const stale = () => !session.active || session.useCache || session.modeGeneration !== generation;
    const wsKey = await getWsKey(session);
    if (stale()) {
      olog("dropping realtime connect \u2014 session switched modes while authorizing");
      return;
    }
    let ws;
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
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
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
        olog("realtime session ready \u2014 streaming audio");
      } else if (msg.type === "input_audio_buffer.speech_started" && msg.item_id) {
        session.speechTimes.set(msg.item_id, { start: session.playbackTime });
        if (session.speechTimes.size > 50) {
          const oldest = session.speechTimes.keys().next().value;
          if (oldest !== void 0) session.speechTimes.delete(oldest);
        }
      } else if (msg.type === "input_audio_buffer.speech_stopped" && msg.item_id) {
        const times = session.speechTimes.get(msg.item_id);
        if (times) times.end = session.playbackTime;
      } else if (msg.type === "conversation.item.input_audio_transcription.completed") {
        const t = (msg.transcript || "").trim();
        const times = msg.item_id ? session.speechTimes.get(msg.item_id) : void 0;
        if (msg.item_id) session.speechTimes.delete(msg.item_id);
        const langOk = session.language === "en" ? /[A-Za-z]{2,}/.test(t) : /[\u3040-\u30FF\u4E00-\u9FFF]/.test(t);
        if (t && langOk) {
          olog("transcript:", t);
          chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t, start: times?.start, end: times?.end }).catch(() => {
          });
        }
      } else if (msg.type === "error") {
        const detail = msg.error && msg.error.message || JSON.stringify(msg);
        olog("realtime error:", String(detail).slice(0, 300));
        if (/api key|invalid_?api|unauthor|authentication/i.test(detail)) {
          report(session.tabId, "invalid-key", detail);
          stop(session.tabId);
        } else if (!session.ready) {
          report(session.tabId, "capture-failed", detail);
          stop(session.tabId);
        }
      }
    };
    ws.onerror = () => olog("realtime WS error event");
    ws.onclose = (ev) => {
      olog("realtime WS closed:", ev.code, ev.reason || "");
      session.ready = false;
      if (!session.active) return;
      if (ev.code !== 4001 && session.reconnects < 3) {
        session.reconnects += 1;
        setTimeout(() => {
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
      report(session.tabId, "connection-lost", "lost connection to the transcription service");
      stop(session.tabId);
    };
  }
  function stop(tabId) {
    const session = sessions[tabId];
    if (!session) return;
    session.active = false;
    setListeningClock(session, false);
    void flushListening(session, true);
    if (session.heartbeat) clearInterval(session.heartbeat);
    if (session.chunkTimer) clearInterval(session.chunkTimer);
    if (session.useCache && session.pcmBuffer.length && !session.playbackPaused) {
      flushChunk(session).catch(() => {
      });
    }
    try {
      if (session.ws && session.ws.readyState <= 1) session.ws.close();
    } catch {
    }
    try {
      session.proc.disconnect();
      session.sink.disconnect();
      session.source.disconnect();
    } catch {
    }
    try {
      session.stream.getTracks().forEach((t) => t.stop());
    } catch {
    }
    session.ctx.close().catch(() => {
    });
    delete sessions[tabId];
    olog("stopped tab", tabId);
  }
})();
