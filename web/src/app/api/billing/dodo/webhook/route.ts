import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normalizePlan, type Plan } from "@/lib/ai-coach";
import {
  billingMetadataPatch,
  parseEntitlement,
  type BillingInterval,
} from "@/lib/plans";
import { refreshSyncTokenProfile } from "@/lib/sync-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Dodo Payments checkout/subscription webhook. This is where billing becomes
// entitlement: on a subscription event we write the buyer's plan to Clerk
// `publicMetadata.plan` (free | pro | max), which then rides on every resolved
// profile + minted sync token so the web app and Worker enforce per-tier caps.
//
// Dodo signs webhooks with the Standard Webhooks spec (https://www.standardwebhooks.com):
// headers webhook-id / webhook-timestamp / webhook-signature, HMAC-SHA256 over
// `${id}.${timestamp}.${rawBody}`, secret `whsec_<base64>`. We verify before
// trusting anything. Field names in the payload are parsed defensively — confirm
// them against Dodo's dashboard test-mode events before go-live.

interface DodoEnv {
  DODO_WEBHOOK_SECRET?: string;
  DODO_PRO_PRODUCT_ID?: string;
  DODO_MAX_PRODUCT_ID?: string;
}

async function readEnv(): Promise<DodoEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as DodoEnv;
  } catch {
    return {
      DODO_WEBHOOK_SECRET: process.env.DODO_WEBHOOK_SECRET,
      DODO_PRO_PRODUCT_ID: process.env.DODO_PRO_PRODUCT_ID,
      DODO_MAX_PRODUCT_ID: process.env.DODO_MAX_PRODUCT_ID,
    };
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]!);
  return btoa(bin);
}

/** Constant-time-ish string compare (avoids early-exit timing leak). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  signatureHeader: string
): Promise<boolean> {
  if (!id || !timestamp || !signatureHeader) return false;
  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = `${id}.${timestamp}.${body}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = bytesToBase64(mac);
  // Header is a space-delimited list of `v1,<sig>` entries.
  return signatureHeader
    .split(" ")
    .map((part) => (part.includes(",") ? part.split(",")[1]! : part))
    .some((sig) => safeEqual(sig, expected));
}

function extractEmail(data: Record<string, unknown>): string | null {
  const customer = data.customer as Record<string, unknown> | undefined;
  const email =
    (customer?.email as string | undefined) ||
    (data.customer_email as string | undefined) ||
    (data.email as string | undefined);
  return typeof email === "string" && email.includes("@") ? email : null;
}

function extractProductId(data: Record<string, unknown>): string | null {
  const pid =
    (data.product_id as string | undefined) ||
    (data.product as { id?: string } | undefined)?.id ||
    ((data.subscription as { product_id?: string } | undefined)?.product_id);
  return typeof pid === "string" ? pid : null;
}

// Each tier's env var holds a comma-separated list of that tier's product ids
// (e.g. monthly + yearly), so both billing cycles map to the same plan.
function idList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Env lists are ordered monthly,yearly — index 0 = monthly, index 1 = yearly.
function intervalForProduct(productId: string | null, env: DodoEnv): BillingInterval | null {
  if (!productId) return null;
  for (const list of [idList(env.DODO_PRO_PRODUCT_ID), idList(env.DODO_MAX_PRODUCT_ID)]) {
    const idx = list.indexOf(productId);
    if (idx === 0) return "monthly";
    if (idx === 1) return "yearly";
    if (idx > 1) return "yearly"; // extra ids treated as non-monthly
  }
  return null;
}

// Active subscription → the product's tier; a terminal event → back to free.
function planForEvent(eventType: string, productId: string | null, env: DodoEnv): Plan | null {
  const t = eventType.toLowerCase();
  const isTerminal = /(cancel|expire|refund|fail|revoke|paused|on_hold)/.test(t);
  if (isTerminal) return "free";
  const isActive = /(active|renew|succeed|create|complete|update|paid)/.test(t);
  if (!isActive) return null;
  if (productId && idList(env.DODO_MAX_PRODUCT_ID).includes(productId)) return "max";
  if (productId && idList(env.DODO_PRO_PRODUCT_ID).includes(productId)) return "pro";
  // Unknown product on an active event: default to the lowest paid tier so a
  // buyer isn't left on free, but never silently grant max.
  return "pro";
}

async function setUserPlan(
  email: string,
  plan: Plan,
  billingInterval: BillingInterval | null
): Promise<boolean> {
  const client = await clerkClient();
  const list = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  const user = list.data[0];
  if (!user) return false;
  // Send ONLY the billing keys: Clerk shallow-merges publicMetadata (null
  // deletes a key), so unrelated keys survive without a racy read-modify-write.
  // Billing owns the plan — it always clears any Max-gift expiry (paid users
  // are metered by their sub; a terminal event means free, never a resurrected
  // gift).
  const patch = billingMetadataPatch(plan, billingInterval);
  await client.users.updateUserMetadata(user.id, {
    publicMetadata: patch,
  });

  // Propagate to the extension's existing sync token: the backend Worker
  // meters caps off the token-embedded profile, so a downgrade (refund,
  // cancellation) must not keep paid caps alive for up to 30 days, and an
  // upgrade should not wait for the user's next web visit. Best-effort — a KV
  // hiccup self-heals on the next token mint, and the Clerk write above is the
  // source of truth.
  try {
    const entitlement = parseEntitlement({
      ...(user.publicMetadata as Record<string, unknown> | undefined),
      ...patch,
    });
    await refreshSyncTokenProfile(user.id, {
      id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? email,
      name: user.firstName || user.username || null,
      plan: entitlement.plan,
      billingInterval: entitlement.billingInterval,
      planExpiresAt: entitlement.planExpiresAt,
    });
  } catch (err) {
    console.warn("[dodo/webhook] sync-token refresh failed", err);
  }
  return true;
}

export async function POST(request: Request) {
  const env = await readEnv();
  if (!env.DODO_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const body = await request.text();
  const ok = await verifySignature(
    env.DODO_WEBHOOK_SECRET,
    request.headers.get("webhook-id") || "",
    request.headers.get("webhook-timestamp") || "",
    body,
    request.headers.get("webhook-signature") || ""
  );
  if (!ok) return NextResponse.json({ error: "bad_signature" }, { status: 401 });

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const eventType = typeof event.type === "string" ? event.type : "";
  const data = (event.data ?? {}) as Record<string, unknown>;
  const productId = extractProductId(data);
  const plan = planForEvent(eventType, productId, env);
  if (!plan) return NextResponse.json({ ok: true, ignored: eventType });
  const billingInterval = plan === "free" ? null : intervalForProduct(productId, env);

  const email = extractEmail(data);
  if (!email) return NextResponse.json({ ok: true, note: "no_customer_email" });

  try {
    const applied = await setUserPlan(email, normalizePlan(plan), billingInterval);
    return NextResponse.json({ ok: true, plan, billingInterval, applied });
  } catch (err) {
    // Return 500 so Dodo retries rather than dropping the entitlement update.
    console.error("[dodo/webhook] failed to apply plan", err);
    return NextResponse.json({ error: "apply_failed" }, { status: 500 });
  }
}
