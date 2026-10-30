/**
 * A best-effort country guess for ordering watch links. It never gates content:
 * every official link stays visible. Timezone beats language because many people
 * use an English UI wherever they live.
 */
const ZONES: [RegExp, string][] = [
  [/^Asia\/Tokyo$/, "JP"],
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
  [/^Europe\/(London|Belfast)$/, "GB"],
  [/^Europe\/(Berlin|Busingen)$/, "DE"],
  [/^Europe\/Paris$/, "FR"],
  [/^Australia\//, "AU"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)$/, "CA"],
  [/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+)|Pacific\/Honolulu|US\/.+)$/, "US"],
];
export const REGION_NAMES: Record<string, string> = { JP: "Japan", US: "the US", CA: "Canada", GB: "the UK", AU: "Australia", DE: "Germany", FR: "France", IN: "India" };

export function guessRegion(timeZone: string | undefined, languages: readonly string[] = []): string | null {
  for (const [pattern, region] of ZONES) if (timeZone && pattern.test(timeZone)) return region;
  for (const language of languages) {
    const region = language.split("-")[1]?.toUpperCase();
    if (region && REGION_NAMES[region]) return region;
  }
  return null;
}

/** Links for the learner's region first, keeping the curated order inside each group. */
export function splitByRegion<T extends { regions: readonly string[] }>(links: readonly T[], region: string | null): { local: T[]; other: T[] } {
  if (!region) return { local: [], other: [...links] };
  return { local: links.filter((l) => l.regions.includes(region)), other: links.filter((l) => !l.regions.includes(region)) };
}
