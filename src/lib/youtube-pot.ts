// YouTube's caption endpoint wants a proof-of-origin token.
//
// A caption track's `baseUrl` from the player response now carries `exp=xpe`,
// and `/api/timedtext` answers those with 200 and an empty body unless the
// request also has the player's `pot` (and `c`) parameters. The hidden-track
// mode fetched the bare baseUrl, got nothing back for every video, reported
// "no Japanese captions", and left the Subtitle Lens with nothing to show
// until Listening Mode started.
//
// The player computes the token itself when it loads captions. The page-world
// script watches for that request and hands the token over; the token is bound
// to the video, so it is good for every track of that video.

export interface PotInfo {
  videoId: string;
  pot: string;
  c: string;
  cver: string;
}

/** The token from a timedtext request the player made, or null. */
export function extractPot(rawUrl: string, base = "https://www.youtube.com"): PotInfo | null {
  let url: URL;
  try {
    url = new URL(rawUrl, base);
  } catch {
    return null;
  }
  if (!url.pathname.endsWith("/api/timedtext")) return null;
  const pot = url.searchParams.get("pot");
  const videoId = url.searchParams.get("v");
  if (!pot || !videoId) return null;
  return {
    videoId,
    pot,
    c: url.searchParams.get("c") || "WEB",
    cver: url.searchParams.get("cver") || "",
  };
}

/** A track URL that asks for json3 and carries the token when we have one. */
export function trackUrl(baseUrl: string, pot: PotInfo | null, origin = "https://www.youtube.com"): string {
  const url = new URL(baseUrl, origin);
  url.searchParams.set("fmt", "json3");
  if (pot) {
    url.searchParams.set("pot", pot.pot);
    url.searchParams.set("c", pot.c);
    if (pot.cver) url.searchParams.set("cver", pot.cver);
  }
  return url.toString();
}
