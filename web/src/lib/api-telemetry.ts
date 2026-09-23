// Route-level request logging: one avc_events row per API call with the
// route, status, latency, and where the caller was.
//
// A wrapper rather than middleware because middleware runs BEFORE the handler
// and so can see neither the status nor the duration — the two things that
// make the panel worth having. The route name is passed in rather than read
// from the URL so that ids in a path can never explode the cardinality.

import { authFailureOf, requestIdentity } from "./request-identity";
import { authKindOf, recordUserEvent, requestFacts } from "./telemetry";

type Handler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

export function withApiTelemetry(route: string, handler: Handler): Handler {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const startedAt = Date.now();
    let status = 500;
    // Stays null when the handler throws, which is how apiErrorCode tells a
    // thrown 500 from one a route returned on purpose.
    let response: Response | null = null;
    try {
      response = await handler(req, ctx);
      status = response.status;
      return response;
    } catch (err) {
      // A throwing handler still gets a row — an unlogged 500 is exactly the
      // one you most want to see. Rethrow so Next's error handling is unchanged.
      status = 500;
      response = null;
      throw err;
    } finally {
      // Everything here is inside its own try/catch because a throw from a
      // `finally` REPLACES the handler's return value — an exception while
      // gathering request facts would turn a perfectly good coach response
      // into a 500. recordUserEvent already swallows its own errors; this
      // guards the calls around it.
      try {
        const facts = requestFacts(req);
        // Identity, not just auth kind (#112). Extension calls arrive with a
        // sync-token bearer and used to land here as "anon", which made every
        // per-user activity query blind to the surface where most of the
        // product actually happens. resolveProfile has almost always already
        // paid for this lookup by now, so it is a memo read, not a KV read.
        const who = await requestIdentity(req);
        // For a streaming response this measures time-to-first-byte, since
        // the Response returns before the body is produced.
        await recordUserEvent({
          kind: "api",
          name: route,
          userId: who.userId,
          plan: who.plan,
          country: facts.country,
          city: facts.city,
          referrerHost: facts.referrerHost,
          device: facts.device,
          authKind: authKindOf(req),
          status,
          durationMs: Date.now() - startedAt,
          errorCode: await apiErrorCode(req, status, response),
        });
      } catch {
        // Observability is never worth a failed request.
      }
    }
  };
}

/**
 * Why an api call failed, for the /owner API errors panel (#160). "" unless
 * the status is a 4xx/5xx.
 *
 * The status alone could not explain /api/anime/context failing 6.8% of the
 * time: a 401 is a dead link or our own KV, and a 502 is OpenAI or KV, and
 * each of those is a different fix. So, in order:
 *
 *  - A handler that threw has no body to read.
 *  - A 401 asks the auth layer, because every route answers the same
 *    `unauthorized` however the token failed.
 *  - Anything else already says what went wrong in its body
 *    (`auto_quota_exhausted`, `missing_title`, `openai_502`, a KV error), so
 *    that is read here rather than re-plumbing every route to report it twice.
 *
 * Never throws; an unreadable reason is "".
 */
export async function apiErrorCode(
  req: Request,
  status: number,
  res: Response | null
): Promise<string> {
  if (status < 400) return "";
  if (!res) return "unhandled";
  if (status === 401) {
    const auth = authFailureOf(req);
    if (auth) return auth;
  }
  return errorCodeFromBody(res);
}

/**
 * Only the two body types routes build their errors as: NextResponse.json
 * sends application/json, and `new Response(JSON.stringify(...))` defaults to
 * text/plain. Anything else (an audio stream, an SSE body) is never cloned.
 */
const ERROR_BODY_TYPE = /^(?:application\/json|text\/plain)\b/i;

/** Error bodies here are a few dozen bytes; anything larger is not one of ours. */
const MAX_ERROR_BODY_CHARS = 4096;

async function errorCodeFromBody(res: Response): Promise<string> {
  try {
    if (!ERROR_BODY_TYPE.test(res.headers.get("content-type") || "")) return "";
    const declared = Number(res.headers.get("content-length"));
    if (declared > MAX_ERROR_BODY_CHARS) return "";
    // A clone, so the route's own response reaches the client untouched.
    const text = await res.clone().text();
    if (text.length > MAX_ERROR_BODY_CHARS) return "";
    const body = JSON.parse(text) as { error?: unknown } | null;
    return normalizeErrorCode(body?.error);
  } catch {
    return "";
  }
}

/**
 * An error string as a GROUP BY label: lowercase, `[a-z0-9_.:-]` only, 64
 * chars at most.
 *
 * Most routes return a fixed code, but some return `err.message` (a KV or
 * network failure), which is exactly the case worth seeing and the one that
 * would otherwise put arbitrary text and spaces into a dashboard column.
 */
export function normalizeErrorCode(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 64)
    .replace(/_+$/, "");
}
