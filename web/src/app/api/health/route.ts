import { NextResponse } from "next/server";
import { atomic } from "@/lib/atomic";
import { resolveStore } from "@/lib/sync-store";

export const dynamic = "force-dynamic";

/**
 * Liveness for the uptime check (.github/workflows/uptime.yml; ISO 25010
 * reliability: availability). Reads only (KV and the Atomic Durable Object),
 * so a probe every few minutes costs no KV writes. No auth, no user data, no
 * telemetry. 503 names the dependency that failed.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  await Promise.all([
    (async () => {
      try {
        await (await resolveStore()).get("health:probe");
        checks.kv = "ok";
      } catch {
        checks.kv = "fail";
      }
    })(),
    (async () => {
      try {
        await (await atomic("health:probe")).get();
        checks.atomic = "ok";
      } catch {
        checks.atomic = "fail";
      }
    })(),
  ]);
  const ok = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
