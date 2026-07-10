/** Meta Pixel helpers — no-ops when NEXT_PUBLIC_META_PIXEL_ID is unset. */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export function metaPixelId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return id || undefined;
}

export function trackMeta(
  event: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("track", event, params);
  } catch {
    // ignore
  }
}

export function trackMetaCustom(
  event: string,
  params?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  try {
    window.fbq?.("trackCustom", event, params);
  } catch {
    // ignore
  }
}
