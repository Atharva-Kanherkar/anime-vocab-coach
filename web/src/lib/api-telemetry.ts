// Route-level request logging: one avc_events row per API call with the
// route, status, latency, and where the caller was.
//
// A wrapper rather than middleware because middleware runs BEFORE the handler
// and so can see neither the status nor the duration — the two things that
// make the panel worth having. The route name is passed in rather than read
// from the URL so that ids in a path can never explode the cardinality.

import { authKindOf, recordUserEvent, requestFacts } from "./telemetry";

type Handler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

export function withApiTelemetry(route: string, handler: Handler): Handler {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const startedAt = Date.now();
    let status = 500;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      return res;
    } catch (err) {
      // A throwing handler still gets a row — an unlogged 500 is exactly the
      // one you most want to see. Rethrow so Next's error handling is unchanged.
      status = 500;
      throw err;
    } finally {
      // Everything here is inside its own try/catch because a throw from a
      // `finally` REPLACES the handler's return value — an exception while
      // gathering request facts would turn a perfectly good coach response
      // into a 500. recordUserEvent already swallows its own errors; this
      // guards the two calls around it.
      try {
        const facts = requestFacts(req);
        // For a streaming response this measures time-to-first-byte, since
        // the Response returns before the body is produced.
        await recordUserEvent({
          kind: "api",
          name: route,
          country: facts.country,
          city: facts.city,
          referrerHost: facts.referrerHost,
          device: facts.device,
          authKind: authKindOf(req),
          status,
          durationMs: Date.now() - startedAt,
        });
      } catch {
        // Observability is never worth a failed request.
      }
    }
  };
}
