import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

const { initialize } = vi.hoisted(() => ({ initialize: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: initialize }));
import config from "../../next.config";

const contextKey = Symbol.for("__cloudflare-context__");
const globals = globalThis as Record<symbol, unknown>;
const originalContext = globals[contextKey];

beforeEach(() => {
  initialize.mockReset();
  delete globals[contextKey];
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_AVC_DEV_NO_CLERK", "");
});
afterEach(() => {
  if (originalContext === undefined) delete globals[contextKey];
  else globals[contextKey] = originalContext;
  vi.unstubAllEnvs();
});

describe("Cloudflare development bindings", () => {
  it("initializes local bindings for a normal Next dev server", () => {
    config(PHASE_DEVELOPMENT_SERVER);
    expect(initialize).toHaveBeenCalledOnce();
  });

  it("preserves a preloaded context shared with the API Worker", () => {
    const sharedContext = { env: { AVC_SYNC_KV: { get: vi.fn() } } };
    globals[contextKey] = sharedContext;
    config(PHASE_DEVELOPMENT_SERVER);
    expect(initialize).not.toHaveBeenCalled();
    expect(globals[contextKey]).toBe(sharedContext);
  });

  it("does not initialize local bindings during a production build", () => {
    config(PHASE_PRODUCTION_BUILD);
    expect(initialize).not.toHaveBeenCalled();
  });

  it("does not initialize local bindings in the production runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    config(PHASE_DEVELOPMENT_SERVER);
    expect(initialize).not.toHaveBeenCalled();
  });
});
