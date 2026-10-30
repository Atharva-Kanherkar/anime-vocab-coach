import { z } from "zod";
import type { N5Catalog } from "../../../shared/n5/contracts";
import { requireN5Auth } from "./auth";
import { CLIPS, CONTENT_VERSION, COURSE_ID, TRACKS, courseOutline, lessonById, publicLesson } from "./course";
import { answersSchema, attemptSchema, completeAnswers, conversationStartSchema, emptySchema, enrolmentSchema, eventSchema, fingerprint, heardSchema, finishSchema, scriptSchema, invalidAnswerQuestionId, turnSchema, validScript } from "./domain";
import { FEEDBACK_SCHEMA, fallbackItems, feedbackPrompt, feedbackRequest, matchedItems, orderItems, parseFeedback } from "./feedback";
import { ProviderError, aiEnabled, speech, structured, transcribe, ttsModel, ttsVoice, type ProviderEnv } from "./provider";
import { CourseError, CourseStore, MAX_TURNS, type StoredTurn } from "./store";
import { GRADE_SCHEMA, TURN_SCHEMA, gradeSystem, parseGrade, parseTurn, transcriptionHint, tutorSystem, type TutorReply } from "./tutor";

export type N5Environment = Partial<Pick<N5Bindings, "N5_ENABLED" | "N5_PREVIEW_USERS" | "N5_DB">> & ProviderEnv;
const MAX_BODY_BYTES = 16_384;
const MAX_TURN_BYTES = 900_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function response(req: Request, data: unknown, status = 200, allow?: string): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-N5-API-Version": "1", "Vary": "Origin" });
  const origin = req.headers.get("Origin");
  if (allow) headers.set("Allow", allow);
  if (origin && allowedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return new Response(JSON.stringify(data), { status, headers });
}
function allowedOrigin(origin: string): boolean {
  return origin === "https://animevocab.com" || origin === "https://www.animevocab.com" || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}
async function body<T>(req: Request, schema: z.ZodType<T>, limit = MAX_BODY_BYTES): Promise<T> {
  if (req.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new CourseError("content_type", 415, "Use application/json.");
  }
  if (!req.body) throw new CourseError("invalid_request", 400, "A JSON body is required.");
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new CourseError("body_too_large", 413, "Request body is too large.");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof CourseError) throw error;
    throw new CourseError("invalid_request", 400, "Request does not match the N5 contract.");
  } finally { reader.releaseLock(); }
}
function method(req: Request, expected: string): void {
  if (req.method !== expected) throw new CourseError("method_not_allowed", 405, `Use ${expected}.`, expected);
}
function notFound(): never { throw new CourseError("not_found", 404, "Course route not found."); }
function audioResponse(req: Request, audio: ArrayBuffer): Response {
  const response = new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=604800, immutable", "X-Content-Type-Options": "nosniff", "X-N5-API-Version": "1", Vary: "Origin" } });
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigin(origin)) response.headers.set("Access-Control-Allow-Origin", origin);
  return response;
}
const unavailable = () => new CourseError("ai_unavailable", 503, "The AI tutor is unavailable right now. Your practice is saved; try again shortly.");
const limited = () => new CourseError("daily_limit", 429, "You've reached today's limit for this practice. It resets tomorrow (UTC).");

/** Speech is cached forever by voice, model and text, so each clip is synthesised once. */
async function cachedSpeech(env: N5Environment & { AVC_KV: KVNamespace }, store: CourseStore, kana: string): Promise<ArrayBuffer> {
  const key = `n5audio:v1:${ttsModel(env)}:${ttsVoice(env)}:${await fingerprint(kana)}`;
  const hit = await env.AVC_KV.get(key, "arrayBuffer");
  if (hit) return hit;
  if (!aiEnabled(env)) throw new CourseError("audio_unavailable", 503, "Audio is unavailable right now.");
  if (!await store.consume("audio")) throw limited();
  let audio: ArrayBuffer;
  try { audio = await speech(env, kana); } catch { throw new CourseError("audio_unavailable", 503, "Audio is unavailable right now."); }
  // KV allows one write per key per second; a concurrent miss may already have stored it.
  try { await env.AVC_KV.put(key, audio); } catch { /* served uncached */ }
  return audio;
}
function decodeAudio(data: string): Uint8Array {
  const binary = atob(data);
  if (binary.length > 600_000) throw new CourseError("body_too_large", 413, "Recordings must be under 30 seconds.");
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function handleN5(req: Request, env: N5Environment & { AVC_KV: KVNamespace }): Promise<Response> {
  try {
    if (env.N5_ENABLED !== "1") notFound();
    const origin = req.headers.get("Origin");
    if (origin && !allowedOrigin(origin)) throw new CourseError("origin_not_allowed", 403, "Origin not allowed.");
    if (req.method === "OPTIONS") return response(req, { apiVersion: 1 });
    const auth = await requireN5Auth(env.AVC_KV, req, (r, _data, status) => response(r, { error: { code: "unauthorized", message: "Sign in to continue." } }, status));
    if (!auth.ok) return auth.response;
    const allowed = (env.N5_PREVIEW_USERS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!allowed.includes(auth.userId)) notFound();
    if (!env.N5_DB) throw new CourseError("course_unavailable", 503, "Course storage is unavailable.");
    const store = new CourseStore(env.N5_DB.withSession("first-primary"), auth.userId);
    const url = new URL(req.url);
    const path = url.pathname.slice("/v1/n5".length);
    const lessonRoute = path.match(/^\/lessons\/([a-z0-9-]{1,100})$/);
    if (!lessonRoute && url.search) throw new CourseError("invalid_request", 400, "Unexpected query parameters.");
    if (path === "/extension/state") { method(req, "GET"); return response(req, await store.extensionState()); }
    const clip = path.match(/^\/audio\/([0-9a-f]{16})$/);
    if (clip) {
      method(req, "GET");
      const kana = CLIPS.get(clip[1]);
      if (kana === undefined) notFound();
      return audioResponse(req, await cachedSpeech(env, store, kana));
    }
    if (path === "/conversations") {
      method(req, "POST");
      const start = await body(req, conversationStartSchema);
      return response(req, await store.startConversation(lessonById(start.lessonId)!, start.idempotencyKey));
    }
    const talk = path.match(/^\/conversations\/([^/]+)(?:\/(turns|finish)(?:\/(\d{1,3})\/audio)?)?$/);
    if (talk) {
      const [, id, action, seq] = talk;
      if (!UUID.test(id)) notFound();
      if (!action) {
        if (req.method === "DELETE") {
          if (req.body) throw new CourseError("invalid_request", 400, "Deletion does not accept a request body.");
          return response(req, await store.abandonConversation(id));
        }
        method(req, "GET");
        return response(req, await store.conversation(id));
      }
      if (seq !== undefined) {
        if (action !== "turns") notFound();
        method(req, "GET");
        const { turns } = await store.conversationContext(id);
        const turn = turns.find((t) => t.seq === Number(seq) && t.role === "tutor" && t.turn.text);
        if (!turn) notFound();
        return audioResponse(req, await cachedSpeech(env, store, turn.turn.text!.kana.replace(/ /g, "")));
      }
      method(req, "POST");
      if (action === "turns") return response(req, await takeTurn(env, store, id, await body(req, turnSchema, MAX_TURN_BYTES)));
      await body(req, emptySchema);
      return response(req, await finishConversation(env, store, id));
    }
    if (path === "/catalog") {
      method(req, "GET");
      return response(req, { apiVersion: 1, courseId: COURSE_ID, contentVersion: CONTENT_VERSION, status: "private_preview", tracks: TRACKS } satisfies N5Catalog);
    }
    if (path === `/courses/${COURSE_ID}`) {
      method(req, "GET");
      return response(req, courseOutline());
    }
    if (path === "/enrolments") {
      method(req, "POST");
      return response(req, await store.enrol(await body(req, enrolmentSchema)));
    }
    if (lessonRoute) {
      const lesson = lessonById(lessonRoute[1]);
      if (!lesson) notFound();
      method(req, "GET");
      if ([...url.searchParams.keys()].some((key) => key !== "script") || url.searchParams.getAll("script").length > 1) throw new CourseError("invalid_request", 400, "Unexpected query parameters.");
      const selected = scriptSchema.safeParse(url.searchParams.get("script") ?? (await store.enrolment())?.script);
      if (!selected.success) throw new CourseError("invalid_script", 400, "Choose romaji or kana.");
      return response(req, publicLesson(lesson, selected.data));
    }
    if (path === "/events") { method(req, "POST"); return response(req, await store.observe(await body(req, eventSchema))); }
    if (path === "/heard") { method(req, "POST"); return response(req, await store.heard(await body(req, heardSchema))); }
    if (path === "/attempts") { method(req, "POST"); return response(req, await store.create(await body(req, attemptSchema))); }
    const match = path.match(/^\/attempts\/([^/]+)(?:\/(answers|finish|feedback))?$/);
    if (match) {
      const [, id, action] = match;
      if (!UUID.test(id)) notFound();
      if (!action && req.method === "DELETE") {
        if (req.body) throw new CourseError("invalid_request", 400, "Deletion does not accept a request body.");
        return response(req, await store.abandon(id));
      }
      if (!action) {
        if (req.method !== "GET") throw new CourseError("method_not_allowed", 405, "Use GET or DELETE.", "GET, DELETE");
        return response(req, await store.get(id));
      }
      method(req, "POST");
      const attempt = await store.get(id);
      // A retired lesson cannot validate answers; the store reports stale content.
      const lesson = lessonById(attempt.lessonId);
      if (action === "answers") {
        const snapshot = await body(req, answersSchema);
        const questionId = lesson ? invalidAnswerQuestionId(lesson, snapshot.answers, attempt.script) : null;
        if (questionId !== null) throw new CourseError("invalid_answers", 400, "Answers must match the pinned questions and script.", undefined, { questionId });
        return response(req, await store.saveAnswers(id, snapshot));
      }
      if (action === "feedback") {
        await body(req, emptySchema);
        if (attempt.status !== "complete") throw new CourseError("attempt_active", 409, "Finish the practice before asking for feedback.");
        if (!lesson || attempt.contentVersion !== CONTENT_VERSION) throw new CourseError("stale_content", 409, "This attempt used retired lesson content.");
        const stored = await store.storedFeedback(id);
        if (stored) return response(req, stored);
        const { matched, pending } = matchedItems(lesson, attempt.answers, attempt.script);
        if (!pending.length) return response(req, await store.saveFeedback({ attemptId: id, script: attempt.script, source: "match", items: orderItems(lesson, matched) }));
        if (aiEnabled(env) && await store.consume("feedback")) {
          try {
            const items = parseFeedback(await structured(env, "typed_feedback", FEEDBACK_SCHEMA, feedbackPrompt(attempt.script), [{ role: "user", content: feedbackRequest(pending, attempt.script) }]), pending, attempt.script);
            if (items) return response(req, await store.saveFeedback({ attemptId: id, script: attempt.script, source: "ai", items: orderItems(lesson, [...matched, ...items]) }));
          } catch (error) { if (!(error instanceof ProviderError)) throw error; }
        }
        // Fallback is never stored, so a later retry can still get AI feedback.
        return response(req, { attemptId: id, script: attempt.script, source: "fallback", items: orderItems(lesson, [...matched, ...fallbackItems(pending, attempt.script)]) });
      }
      const finish = await body(req, finishSchema);
      if (attempt.status !== "complete" && lesson && !completeAnswers(lesson, attempt.answers, attempt.script)) throw new CourseError("incomplete_answers", 409, "Answer every question before finishing.");
      return response(req, await store.finish(id, finish.revision));
    }
    if (path === "/me/progress") { method(req, "GET"); return response(req, await store.progress()); }
    if (path === "/me/reviews") { method(req, "GET"); return response(req, await store.reviews()); }
    if (path === "/me/export") { method(req, "GET"); return response(req, await store.exportData()); }
    if (path === "/me") {
      method(req, "DELETE");
      if (req.body) throw new CourseError("invalid_request", 400, "Deletion does not accept a request body.");
      await store.deleteData(); return response(req, { deleted: true });
    }
    notFound();
  } catch (error) {
    if (error instanceof CourseError) return response(req, { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, error.status, error.allow);
    // Do not log typed answers, bearer tokens, database payloads or provider evidence.
    return response(req, { error: { code: "course_unavailable", message: "Course storage is unavailable; retry later." } }, 503);
  }
}

async function takeTurn(env: N5Environment, store: CourseStore, id: string, input: z.infer<typeof turnSchema>) {
  const hash = await fingerprint({ conversationId: id, ...input });
  const replayed = await store.replayTurn(input.idempotencyKey, hash);
  if (replayed) {
    if (replayed !== id) throw new CourseError("conflict", 409, "Request conflicts with saved state; refresh before retrying.");
    return store.conversation(id);
  }
  const { row, turns } = await store.conversationContext(id);
  if (row.status !== "active") throw new CourseError("conversation_complete", 409, "This conversation is finished. Start a new one to keep practising.");
  const lesson = lessonById(row.lesson_id);
  if (!lesson || row.content_version !== CONTENT_VERSION) throw new CourseError("stale_content", 409, "This conversation used retired lesson content.");
  const last = turns[turns.length - 1]?.seq ?? -1;
  if (input.afterSeq !== last) throw new CourseError("conflict", 409, "The conversation moved on in another tab. Reload it to continue.");
  if (turns.filter((t) => t.role === "learner").length >= MAX_TURNS) throw new CourseError("turn_limit", 409, "That's the end of this conversation. Finish it to see your feedback.");
  if (input.text !== undefined && !validScript(input.text, row.script)) throw new CourseError("invalid_script", 400, `Type your reply in ${row.script} only.`);
  if (!aiEnabled(env)) throw unavailable();
  if (!await store.consume("turn")) throw limited();
  let said: string;
  try {
    said = input.audio ? await transcribe(env, decodeAudio(input.audio.data), input.audio.mime, transcriptionHint(lesson)) : input.text!;
  } catch (error) { if (error instanceof ProviderError) throw unavailable(); throw error; }
  if (!said.trim()) throw new CourseError("no_speech", 422, "We couldn't hear any speech. Try again a little closer to the microphone.");
  const history = turns.map((t) => ({ role: t.role === "tutor" ? "assistant" as const : "user" as const, content: (t.role === "tutor" ? t.turn.text?.kana : t.turn.raw ?? t.turn.text?.kana) ?? "" }));
  history.push({ role: "user", content: said });
  let reply: TutorReply | null = null;
  try {
    for (let tries = 0; tries < 2 && !reply; tries++) reply = parseTurn(await structured(env, "tutor_turn", TURN_SCHEMA, tutorSystem(lesson, row.script), history), row.script);
  } catch (error) { if (error instanceof ProviderError) throw unavailable(); throw error; }
  if (!reply) throw unavailable();
  const learner: StoredTurn = {
    role: "learner", english: null, raw: said, input: input.audio ? "voice" : "text",
    // Typed text is shown exactly as typed; speech shows the tutor's validated rewrite, or nothing.
    text: input.text !== undefined ? { romaji: input.text, kana: input.text } : reply.heard,
  };
  const tutor: StoredTurn = { role: "tutor", text: reply.reply, english: reply.english, tip: reply.tip, correction: reply.correction };
  await store.appendTurns(id, last, input.idempotencyKey, hash, learner, tutor);
  return store.conversation(id);
}

async function finishConversation(env: N5Environment, store: CourseStore, id: string) {
  const { row, turns } = await store.conversationContext(id);
  if (row.status === "complete") return store.conversation(id);
  const lesson = lessonById(row.lesson_id);
  if (!lesson || row.content_version !== CONTENT_VERSION) throw new CourseError("stale_content", 409, "This conversation used retired lesson content.");
  const learnerTurns = turns.filter((t) => t.role === "learner");
  if (!learnerTurns.length) throw new CourseError("no_turns", 409, "Say something to Haru before finishing.");
  if (!aiEnabled(env)) throw unavailable();
  if (!await store.consume("grade")) throw limited();
  const transcript = turns.map((t) => (t.role === "tutor" ? `Haru: ${t.turn.text?.kana ?? ""}` : `Learner (${t.turn.input}): ${t.turn.raw ?? t.turn.text?.kana ?? ""}`)).join("\n");
  let result = null;
  try {
    result = parseGrade(await structured(env, "speaking_grade", GRADE_SCHEMA, gradeSystem(lesson), [{ role: "user", content: transcript }]), row.script, learnerTurns.filter((t) => t.turn.input === "voice").length);
  } catch (error) { if (error instanceof ProviderError) throw unavailable(); throw error; }
  if (!result) throw unavailable();
  await store.finishConversation(id, result);
  return store.conversation(id);
}
