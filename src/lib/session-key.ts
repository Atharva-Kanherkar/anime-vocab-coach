// Private transcription keys for signed-in Listening sessions with no episode
// identity (yet). The backend transcribes and bills audio under one of these
// but never caches or shares it; its validator accepts exactly this shape
// (backend/src/validate.ts, TRANSCRIBE_ONLY_KEY_RE).
export function privateSessionKey(language: "ja" | "en"): string {
  return `sess:${crypto.randomUUID().replace(/-/g, "")}:${language}`;
}
