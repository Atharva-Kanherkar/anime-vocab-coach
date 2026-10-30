import type { N5WatchLink } from "../../../shared/n5/contracts";

/**
 * Official, legal places to watch Your Lie in April. Regions come from JustWatch
 * listings and each URL was opened on the checked date; availability changes, so
 * learners are always told to check their region. No affiliate or tracking links.
 */
export const WATCH_CHECKED = "2026-10-30";
interface WatchSource {
  provider: string;
  regions: string[];
  access: N5WatchLink["access"];
  series: string;
  /** Direct link to episode n, where the service has stable public episode pages. */
  episode?: (n: number) => string;
  note?: string;
}
const pad = (n: number, width: number) => String(n).padStart(width, "0");
export const WATCH_SOURCES: readonly WatchSource[] = [
  { provider: "Netflix", regions: ["JP", "US", "CA", "GB", "AU", "DE"], access: "subscription", series: "https://www.netflix.com/title/80041089" },
  { provider: "U-NEXT", regions: ["JP"], access: "subscription", series: "https://video.unext.jp/title/SID0012508", episode: (n) => `https://video.unext.jp/episode/SID0012508/ED${pad(71631 + n, 8)}` },
  { provider: "FOD", regions: ["JP"], access: "subscription", series: "https://fod.fujitv.co.jp/title/5244/", episode: (n) => `https://fod.fujitv.co.jp/title/5244/52441100${pad(n, 2)}/` },
  { provider: "Hulu Japan", regions: ["JP"], access: "subscription", series: "https://www.hulu.jp/watch/100154541" },
  { provider: "Prime Video Japan", regions: ["JP"], access: "subscription", series: "https://www.amazon.co.jp/dp/B0H2WMCJ2Q", note: "Through the d Anime Store or Anime Times channel" },
  { provider: "Crunchyroll", regions: ["US", "CA", "GB", "AU", "IN", "FR"], access: "subscription", series: "https://www.crunchyroll.com/series/G63V7KN9Y/your-lie-in-april", note: "Not available in Japan" },
  { provider: "Hulu", regions: ["US"], access: "subscription", series: "https://www.hulu.com/series/your-lie-in-april-8156b6d6-46ae-4576-877e-022657255de6" },
  { provider: "Prime Video", regions: ["US", "CA", "GB", "AU", "IN"], access: "subscription", series: "https://www.primevideo.com/detail?gti=amzn1.dv.gti.4f75748b-eca8-40ec-87f7-e98f49e4e67b", note: "Crunchyroll channel; free with ads in India" },
  { provider: "Sony LIV", regions: ["IN"], access: "subscription", series: "https://www.sonyliv.com/shows/your-lie-in-april-1790007188" },
  { provider: "ADN", regions: ["FR"], access: "subscription", series: "https://animationdigitalnetwork.com/video/1203-your-lie-in-april", episode: (n) => `https://animationdigitalnetwork.com/video/1203-your-lie-in-april/${25756 + n}-episode-${n}` },
  { provider: "Apple TV", regions: ["AU"], access: "purchase", series: "https://tv.apple.com/au/show/your-lie-in-april/umc.cmc.naxbo7gbxumja097wwstdo2t" },
];

export function watchLinks(episode: number | null): N5WatchLink[] {
  if (episode === null) return [];
  return WATCH_SOURCES.map((source) => ({
    provider: source.provider,
    url: source.episode ? source.episode(episode) : source.series,
    scope: source.episode ? "episode" : "series",
    regions: source.regions,
    access: source.access,
    note: source.note ?? null,
    checkedAt: WATCH_CHECKED,
  }));
}
