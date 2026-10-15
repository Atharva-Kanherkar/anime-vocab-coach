// Ceilings for calls this Worker makes to other services (ISO 25010
// reliability audit). fetch() has no timeout of its own, so a stalled OpenAI
// or analytics request held the learner's request (and a Worker slot) open
// until the platform killed it. Bounding these also bounds every page's call
// to our own API, since each of those waits on at most one of them.
export const UPSTREAM_TIMEOUT_MS = {
  /** Small JSON APIs (analytics SQL, IndexNow). */
  quick: 15_000,
  /** A chat completion returned in one piece (these models may reason first). */
  chat: 60_000,
  /** A deliberately long reasoning call (the owner's insights digest). */
  reasoning: 180_000,
  /** A streamed chat completion: the whole stream, not the first byte. */
  stream: 120_000,
  /** Speech synthesis. */
  tts: 30_000,
  /** Image generation and edits, which routinely take 30-60s. */
  image: 150_000,
} as const;

export function upstreamTimeout(kind: keyof typeof UPSTREAM_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS[kind]);
}
