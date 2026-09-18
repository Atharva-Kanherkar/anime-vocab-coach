export interface FunnelAttribution {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
}

const MAX_UTM_LENGTH = 80;
const SAFE_UTM = /^[a-z0-9][a-z0-9._-]*$/;

/** Low-cardinality campaign value safe for Analytics Engine grouping. */
export function normalizeUtm(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().slice(0, MAX_UTM_LENGTH);
  return SAFE_UTM.test(normalized) ? normalized : "";
}

export function normalizeAttribution(input: {
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}): FunnelAttribution {
  return {
    utmSource: normalizeUtm(input.utm_source),
    utmMedium: normalizeUtm(input.utm_medium),
    utmCampaign: normalizeUtm(input.utm_campaign),
  };
}

export function attributionFromSearch(search: string): FunnelAttribution {
  const params = new URLSearchParams(search);
  return normalizeAttribution({
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  });
}

export function isPublicLandingPath(pathname: string): boolean {
  return !/^\/(?:api|app|owner|sign-in|sign-up)(?:\/|$)/.test(pathname);
}

export function ownedCampaignForPath(pathname: string): string {
  if (pathname === "/") return "homepage";
  return normalizeUtm(pathname.replace(/^\/(?:ja\/)?/, "").replaceAll("/", "_")) || "site_cta";
}
