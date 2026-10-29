import { z } from "zod";
import type { N5Catalog, N5Course } from "../../../shared/n5/contracts";
import { requireN5Auth } from "./auth";
import { CONTENT_VERSION, COURSE_ID, LESSON_ID, TRACKS, UNITS } from "./content";
import { answersSchema, attemptSchema, completeAnswers, enrolmentSchema, eventSchema, finishSchema, publicLesson, scriptSchema, invalidAnswerQuestionId } from "./domain";
import { CourseError, CourseStore } from "./store";

export type N5Environment = Partial<Pick<N5Bindings, "N5_ENABLED" | "N5_PREVIEW_USERS" | "N5_DB">>;
const MAX_BODY_BYTES = 16_384;
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
async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
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
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new CourseError("body_too_large", 413, "JSON body exceeds 16 KiB.");
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
    if (path !== `/lessons/${LESSON_ID}` && url.search) throw new CourseError("invalid_request", 400, "Unexpected query parameters.");
    if (path === "/catalog") {
      method(req, "GET");
      return response(req, { apiVersion: 1, courseId: COURSE_ID, contentVersion: CONTENT_VERSION, status: "private_preview", tracks: TRACKS } satisfies N5Catalog);
    }
    if (path === `/courses/${COURSE_ID}`) {
      method(req, "GET");
      return response(req, { apiVersion: 1, courseId: COURSE_ID, contentVersion: CONTENT_VERSION, units: UNITS,
        limitation: "Preview practice only. No JLPT pass prediction or complete literacy/speaking assessment.", availableLessons: [LESSON_ID] } satisfies N5Course);
    }
    if (path === "/enrolments") {
      method(req, "POST");
      return response(req, await store.enrol(await body(req, enrolmentSchema)));
    }
    if (path === `/lessons/${LESSON_ID}`) {
      method(req, "GET");
      if ([...url.searchParams.keys()].some((key) => key !== "script") || url.searchParams.getAll("script").length > 1) throw new CourseError("invalid_request", 400, "Unexpected query parameters.");
      const selected = scriptSchema.safeParse(url.searchParams.get("script") ?? (await store.enrolment())?.script);
      if (!selected.success) throw new CourseError("invalid_script", 400, "Choose romaji or kana.");
      return response(req, publicLesson(selected.data));
    }
    if (path === "/events") { method(req, "POST"); return response(req, await store.observe(await body(req, eventSchema))); }
    if (path === "/attempts") { method(req, "POST"); return response(req, await store.create(await body(req, attemptSchema))); }
    const match = path.match(/^\/attempts\/([^/]+)(?:\/(answers|finish|voice))?$/);
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
      if (action === "voice") throw new CourseError("voice_unavailable", 503, "Speaking assessment is not available in this preview.");
      if (action === "answers") {
        const snapshot = await body(req, answersSchema);
        const questionId = invalidAnswerQuestionId(snapshot.answers, attempt.script);
        if (questionId !== null) throw new CourseError("invalid_answers", 400, "Answers must match the pinned questions and script.", undefined, { questionId });
        return response(req, await store.saveAnswers(id, snapshot));
      }
      const finish = await body(req, finishSchema);
      if (attempt.status !== "complete" && !completeAnswers(attempt.answers, attempt.script)) throw new CourseError("incomplete_answers", 409, "Answer every question before finishing.");
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
