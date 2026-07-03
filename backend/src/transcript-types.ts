/** Timestamped transcript segment — aligned to video playback time (seconds). */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export type TranscriptSource = "whisper" | "subtitle_track";

export interface TranscriptRecord {
  modelVersion: string;
  source: TranscriptSource;
  createdAt: string;
  segments: TranscriptSegment[];
}

export interface TranscriptMeta {
  cacheKey: string;
  modelVersion: string;
  source: TranscriptSource;
  createdAt: string;
  hitCount: number;
  missCount: number;
  segmentCount: number;
}
