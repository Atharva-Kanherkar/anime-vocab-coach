// Dodo Payments license API. License keys are attached to the Pro
// subscription product; Dodo marks the key invalid when the subscription
// is cancelled or payment fails, so "key valid" == "subscription active".
//
// Docs: https://docs.dodopayments.com/api-reference/licenses
// (verify paths/fields against the current docs before first deploy).

import type { Env } from "./index";

interface DodoValidateResponse {
  valid?: boolean;
  status?: string;
  error?: { message?: string } | string;
}

interface DodoActivateResponse {
  id?: string;
  error?: { message?: string } | string;
}

function errMsg(e: DodoValidateResponse["error"]): string {
  if (!e) return "license invalid";
  return typeof e === "string" ? e : e.message || "license invalid";
}

export async function validateLicense(env: Env, licenseKey: string): Promise<{ valid: boolean; reason?: string }> {
  const res = await fetch(`${env.DODO_API_BASE}/licenses/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DODO_API_KEY}`
    },
    body: JSON.stringify({ license_key: licenseKey })
  });
  const data = (await res.json().catch(() => ({}))) as DodoValidateResponse;
  if (res.ok && data.valid !== false) return { valid: true };
  return { valid: false, reason: errMsg(data.error) };
}

// First-time activation binds the key to an "instance" in Dodo's dashboard
// (useful for revoking abusers). We don't need the instance id afterwards —
// validate works on the bare key.
export async function activateLicense(env: Env, licenseKey: string): Promise<{ valid: boolean; reason?: string }> {
  const res = await fetch(`${env.DODO_API_BASE}/licenses/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ license_key: licenseKey, name: "anime-vocab-coach" })
  });
  if (res.ok) return { valid: true };

  // Already activated on a previous install — fall back to validate.
  const data = (await res.json().catch(() => ({}))) as DodoActivateResponse;
  const fallback = await validateLicense(env, licenseKey);
  if (fallback.valid) return fallback;
  return { valid: false, reason: errMsg(data.error) };
}
