// Offscreen document: captures a tab's audio, chunks it, and sends each chunk
// to OpenAI's transcription API. Runs here because getUserMedia and
// MediaRecorder don't exist in MV3 service workers.
//
// The offscreen console is nearly impossible to inspect, so every step is
// forwarded to the service-worker console via avc-offscreen-log. Open it at
// chrome://extensions -> Anime Vocab Coach -> "service worker".

const CHUNK_MS = 12000;
const MIN_BLOB_BYTES = 2000; // skip near-empty chunks (silence/scene cuts)

const sessions = {}; // tabId -> session

function olog(...args) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  chrome.runtime.sendMessage({ type: "avc-offscreen-log", line }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "avc-offscreen-start") {
    olog("start received for tab", msg.tabId, "model", msg.model);
    start(msg)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        olog("START FAILED:", String(err && err.message || err));
        report(msg.tabId, "capture-failed", String(err && err.message || err));
        sendResponse({ ok: false, error: String(err && err.message || err) });
      });
    return true; // keep the channel open for the async sendResponse
  }
  if (msg.type === "avc-offscreen-stop") {
    stop(msg.tabId);
    sendResponse({ ok: true });
  }
});

function report(tabId, code, detail) {
  chrome.runtime.sendMessage({ type: "avc-listen-error", tabId, code, detail }).catch(() => {});
}

async function start({ streamId, tabId, key, model }) {
  if (sessions[tabId]) stop(tabId);

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId
        }
      }
    });
  } catch (err) {
    throw new Error("getUserMedia(tab) failed: " + (err && err.message || err));
  }
  olog("tab audio stream acquired, tracks:", stream.getAudioTracks().length);

  // Capturing mutes the tab unless the audio is routed back to the speakers.
  const ctx = new AudioContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  const session = { stream, ctx, key, model, tabId, active: true, recorder: null, timer: null, n: 0 };
  sessions[tabId] = session;
  recordLoop(session);
  olog("recording loop started (12s chunks)");
}

function recordLoop(session) {
  if (!session.active) return;

  // A fresh MediaRecorder per chunk so every blob is a standalone playable
  // webm file (timeslice chunks after the first lack the container header).
  let rec;
  try {
    rec = new MediaRecorder(session.stream, { mimeType: "audio/webm;codecs=opus" });
  } catch (err) {
    // Some builds label it differently; fall back to default.
    try { rec = new MediaRecorder(session.stream); }
    catch (err2) { report(session.tabId, "recorder-error", String(err2)); olog("MediaRecorder ctor failed:", String(err2)); return; }
  }
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    recordLoop(session); // next chunk starts immediately; gap is ~ms
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    session.n += 1;
    olog(`chunk #${session.n} recorded, ${blob.size} bytes`);
    if (blob.size >= MIN_BLOB_BYTES) {
      transcribe(session, blob).catch((err) => olog("transcribe threw:", String(err)));
    } else {
      olog(`chunk #${session.n} skipped (< ${MIN_BLOB_BYTES} bytes — silence?)`);
    }
  };
  rec.onerror = (e) => { report(session.tabId, "recorder-error", ""); olog("recorder error:", String(e && e.error)); };

  rec.start();
  session.recorder = rec;
  session.timer = setTimeout(() => {
    try { if (rec.state === "recording") rec.stop(); } catch (err) { /* already stopped */ }
  }, CHUNK_MS);
}

async function transcribe(session, blob) {
  const form = new FormData();
  form.append("file", blob, "chunk.webm");
  form.append("model", session.model);
  form.append("language", "ja");

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.key}` },
      body: form
    });
  } catch (err) {
    olog("network error posting to OpenAI:", String(err));
    return;
  }

  if (res.status === 401) {
    olog("OpenAI 401 — invalid key");
    report(session.tabId, "invalid-key", "OpenAI rejected the API key (401).");
    stop(session.tabId);
    return;
  }
  if (res.status === 429) {
    olog("OpenAI 429 — rate limited / quota");
    report(session.tabId, "rate-limited", "OpenAI rate limit / quota exceeded (429).");
    return;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    olog(`OpenAI HTTP ${res.status}: ${body.slice(0, 200)}`);
    return;
  }

  const data = await res.json();
  const text = (data.text || "").trim();
  if (text && /[぀-ヿ一-鿿]/.test(text)) {
    olog("transcript:", text);
    chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text }).catch(() => {});
  } else {
    olog("transcript had no Japanese, dropped:", JSON.stringify(text));
  }
}

function stop(tabId) {
  const session = sessions[tabId];
  if (!session) return;
  session.active = false;
  if (session.timer) clearTimeout(session.timer);
  try { if (session.recorder && session.recorder.state === "recording") session.recorder.stop(); } catch (err) { /* noop */ }
  session.stream.getTracks().forEach((t) => t.stop());
  session.ctx.close().catch(() => {});
  delete sessions[tabId];
  olog("stopped tab", tabId);
}
