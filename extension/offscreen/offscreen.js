"use strict";
(() => {
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
      headers: { Authorization: "Bearer " + session.auth.syncToken }
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
  function startHeartbeat(session) {
    if (session.auth.kind !== "cloud") return;
    const { backendUrl, syncToken } = session.auth;
    session.heartbeat = setInterval(async () => {
      if (!session.active || session.playbackPaused) return;
      try {
        const res = await fetch(backendUrl + "/v1/usage/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + syncToken },
          body: JSON.stringify({ minutes: 5 })
        });
        if (res.status === 429) {
          olog("monthly cap reached \u2014 stopping");
          report(session.tabId, "quota-exceeded", "monthly listening hours used up");
          stop(session.tabId);
        }
      } catch (err) {
        olog("heartbeat failed (will retry):", String(err));
      }
    }, 5 * 60 * 1e3);
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
    session.playbackTime = time;
    session.playbackPaused = paused;
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
        report(msg.tabId, code, detail);
        sendResponse({ ok: false, error: detail });
      });
      return true;
    }
    if (msg.type === "avc-offscreen-stop") {
      stop(msg.tabId);
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
    if (session.transcribing || !session.cacheKey || session.auth.kind !== "cloud") return;
    if (session.playbackPaused) return;
    if (!session.chunkStarted || pcmSampleCount(session.pcmBuffer) < MIN_PCM_SAMPLES) return;
    const pcm = concatPcm(session.pcmBuffer);
    resetAudioBuffer(session);
    const startSec = session.chunkStartSec;
    session.transcribing = true;
    try {
      olog("transcribing chunk at playback", startSec, "samples", pcm.length);
      const res = await fetch(session.auth.backendUrl + "/v1/transcript/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.auth.syncToken
        },
        body: JSON.stringify({ key: session.cacheKey, startSec, audio: base64Int16(pcm) })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        report(session.tabId, "quota-exceeded", data.error || "monthly listening hours used up");
        stop(session.tabId);
        return;
      }
      if (!res.ok) throw new Error(data.error || "transcribe HTTP " + res.status);
      for (const seg of data.segments || []) {
        const t = (seg.text || "").trim();
        if (t && /[぀-ヿ一-鿿]/.test(t)) {
          olog(data.hit ? "cache hit:" : "transcribed:", t);
          chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t }).catch(() => {
          });
        }
      }
    } catch (err) {
      olog("chunk transcribe failed:", String(err));
    } finally {
      session.transcribing = false;
    }
  }
  async function start({ streamId, tabId, auth, model, cacheKey }) {
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
      tabId,
      srcRate: ctx.sampleRate,
      reconnects: 0,
      heartbeat: null,
      cacheKey: cacheKey || "",
      playbackTime: 0,
      playbackPaused: true,
      pcmBuffer: [],
      chunkStartSec: 0,
      chunkStarted: false,
      transcribing: false,
      chunkTimer: null,
      useCache
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
      session.chunkTimer = setInterval(() => {
        if (session.active) flushChunk(session).catch((err) => olog("flush error:", String(err)));
      }, CHUNK_SEC * 1e3);
      startHeartbeat(session);
      return;
    }
    olog("audio graph ready (src rate", session.srcRate + "Hz), connecting realtime WS");
    await connectWS(session);
    startHeartbeat(session);
  }
  async function connectWS(session) {
    const wsKey = await getWsKey(session);
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
                transcription: { model: session.model, language: "ja" },
                turn_detection: { type: "server_vad", silence_duration_ms: 500 }
              }
            }
          }
        }));
      } else if (msg.type === "session.updated") {
        session.ready = true;
        session.reconnects = 0;
        olog("realtime session ready \u2014 streaming audio");
      } else if (msg.type === "conversation.item.input_audio_transcription.completed") {
        const t = (msg.transcript || "").trim();
        if (t && /[぀-ヿ一-鿿]/.test(t)) {
          olog("transcript:", t);
          chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text: t }).catch(() => {
          });
        }
      } else if (msg.type === "error") {
        const detail = msg.error && msg.error.message || JSON.stringify(msg);
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
      if (!session.active) return;
      if (ev.code !== 4001 && session.reconnects < 3) {
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
