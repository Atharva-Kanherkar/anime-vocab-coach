// Node stand-in for the "cloudflare:workers" runtime module, so unit tests can
// import code that defines Durable Object classes. Only the base class shape
// is needed; the tests drive the pure slot functions, not a live object.
export class DurableObject<Env = unknown> {
  protected ctx: unknown;
  protected env: Env;
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
