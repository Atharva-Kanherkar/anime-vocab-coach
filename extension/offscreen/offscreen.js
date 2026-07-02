// Offscreen document: captures a tab's audio, chunks it, and sends each chunk
// to OpenAI's transcription API. Runs here because getUserMedia and
// MediaRecorder don't exist in MV3 service workers.

const CHUNK_MS = 12000;
const MIN_BLOB_BYTES = 4000; // skip near-empty chunks (silence/scene cuts)

const sessions = {}; // tabId -> session

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "avc-offscreen-start") {
    start(msg).catch((err) => {
      report(msg.tabId, "capture-failed", String(err.message || err));
    });
  } else if (msg.type === "avc-offscreen-stop") {
    stop(msg.tabId);
  }
});

function report(tabId, code, detail) {
  chrome.runtime.sendMessage({ type: "avc-listen-error", tabId, code, detail }).catch(() => {});
}

async function start({ streamId, tabId, key, model }) {
  if (sessions[tabId]) stop(tabId);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });

  // Capturing mutes the tab unless the audio is routed back to the speakers.
  const ctx = new AudioContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  const session = { stream, ctx, key, model, tabId, active: true, recorder: null, timer: null };
  sessions[tabId] = session;
  recordLoop(session);
}

function recordLoop(session) {
  if (!session.active) return;

  // A fresh MediaRecorder per chunk so every blob is a standalone playable
  // webm file (timeslice chunks after the first lack the container header).
  const rec = new MediaRecorder(session.stream, { mimeType: "audio/webm;codecs=opus" });
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    recordLoop(session); // next chunk starts immediately; gap is ~ms
    const blob = new Blob(chunks, { type: "audio/webm" });
    if (blob.size >= MIN_BLOB_BYTES) {
      transcribe(session, blob).catch(() => {});
    }
  };
  rec.onerror = () => report(session.tabId, "recorder-error", "");

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
    return; // network blip: drop this chunk, keep listening
  }

  if (res.status === 401) {
    report(session.tabId, "invalid-key", "OpenAI rejected the API key (401).");
    stop(session.tabId);
    return;
  }
  if (res.status === 429) {
    report(session.tabId, "rate-limited", "OpenAI rate limit / quota exceeded (429).");
    return;
  }
  if (!res.ok) return;

  const data = await res.json();
  const text = (data.text || "").trim();
  // Only forward lines containing Japanese script — hallucinated English/empty
  // transcripts of music or silence are dropped here.
  if (text && /[぀-ヿ一-鿿]/.test(text)) {
    chrome.runtime.sendMessage({ type: "avc-transcript", tabId: session.tabId, text }).catch(() => {});
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
}
