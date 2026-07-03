import * as storage from "./storage";
import { deriveCacheKey } from "./cache-key";
import { prefillTranscript } from "./transcript-client";
import type { TranscriptSegment } from "../types";
import type { PlatformId } from "./cache-key";

/** Upload subtitle cues to the shared transcript cache (Pro only, best-effort). */
export async function uploadSubtitlePrefill(
  platform: PlatformId,
  segments: TranscriptSegment[]
): Promise<void> {
  if (!segments.length) return;
  const settings = await storage.getSettings();
  if (!settings.licenseKey) return;
  const keyResult = deriveCacheKey(platform);
  if (!keyResult) return;
  try {
    await prefillTranscript(settings.licenseKey, keyResult.key, segments, "subtitle_track");
  } catch (err) {
    console.warn("[AVC] subtitle prefill failed:", err);
  }
}
