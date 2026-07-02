// Offscreen document: captures a tab's audio and streams it to OpenAI's GA
// Realtime transcription API over a WebSocket, so transcripts arrive within
// ~1-2s of a line being spoken (vs 12-30s for the old chunk-and-POST approach).
//
// The offscreen console is nearly impossible to inspect, so every step is
// forwarded to the service-worker console via avc-offscreen-log. Open it at
// chrome://extensions -> Anime Vocab Coach -> "service worker".

const RT_URL = "wss://api.openai.com/v1/realtime?intent=transcription";
const OUT_RATE = 24000;

const sessions = {}; // tabId -> session

function olog(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  chrome.runtime.sendMessage({ type: "avc-offscreen-log", line }).catch(() => {});
}

function report(tabId, code, detail) {
  chrome.runtime.sendMessage({ type: "avc-listen-error", tabId, code, detail }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "avc-offscreen-start") {
    olog("start received for tab", msg.tabId, "model", msg.model);
    start(msg)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        olog("START FAILED:", String((err && err.message) || err));
        report(msg.tabId, "capture-failed", String((err && err.message) || err));
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      });
    return true; // keep channel open for async sendResponse
  }
  if (msg.type === "avc-offscreen-stop") {
    stop(msg.tabId);
    sendResponse({ ok: true });
  }
});

function downsample(f32, srcRate) {
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

function base64Int16(int16) {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

async function start({ streamId, tabId, key, model }) {
  if (sessions[tabId]) stop(tabId);

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId } }
    });
  } catch (err) {
    throw new Error("getUserMedia(tab) failed: " + ((err && err.message) || err));
  }
  olog("tab audio stream acquired, tracks:", stream.getAudioTracks().length);

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  // Playback: route the captured audio back to the speakers at full quality,
  // else tabCapture leaves the tab silent for the viewer.
  source.connect(ctx.destination);

  // Capture: tap the same source through a processor whose output is muted.
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);

  const session = {
    ws: null, ctx, stream, proc, sink, source,
    active: true, ready: false, key, model, tabId,
    srcRate: ctx.sampleRate, reconnects: 0
  };
  sessions[tabId] = session;

  proc.onaudioprocess = (e) => {
    if (!session.active || !session.ready) return;
    if (!session.ws || session.ws.readyState !== WebSocket.OPEN) return;
    const pcm = downsample(e.inputBuffer.getChannelData(0), session.srcRate);
    try {
      session.ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64Int16(pcm) }));
    } catch (err) { /* socket mid-close */ }
  };

  olog("audio graph ready (src rate", session.srcRate + "Hz), connecting realtime WS");
  connectWS(session);
}

function connectWS(session) {
  let ws;
  try {
    ws = new WebSocket(RT_URL, ["realtime", "openai-insecure-api-key." + session.key]);
  } catch (err) {
    olog("WebSocket ctor failed:", String(err));
    report(session.tabId, "capture-failed", String(err));
    return;
  }
  session.ws = ws;

  ws.onopen = () => olog("realtime WS open");

  ws.onmessage = (e) => {
    let msg;
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
      } else {
        olog("transcript dropped (no Japanese):", JSON.stringify(t));
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
    // 4001-ish / auth closes should not loop; otherwise try a couple reconnects.
    if (session.active && session.reconnects < 3 && ev.code !== 4001) {
      session.reconnects += 1;
      setTimeout(() => { if (session.active) { olog("reconnecting realtime WS (try " + session.reconnects + ")"); connectWS(session); } }, 1500);
    }
  };
}

function stop(tabId) {
  const session = sessions[tabId];
  if (!session) return;
  session.active = false;
  try { if (session.ws && session.ws.readyState <= 1) session.ws.close(); } catch (err) { /* noop */ }
  try { session.proc.disconnect(); session.sink.disconnect(); session.source.disconnect(); } catch (err) { /* noop */ }
  try { session.stream.getTracks().forEach((t) => t.stop()); } catch (err) { /* noop */ }
  session.ctx.close().catch(() => {});
  delete sessions[tabId];
  olog("stopped tab", tabId);
}
