import { describe, expect, it } from "vitest";
import {
  EXPORT_HOURS,
  RAW_ROW_LIMIT,
  exportFilename,
  extensionFunnelDailySql,
  nameRows,
  parseMeterKey,
  rawEventsSql,
  rawLlmSql,
  summarizeBackup,
} from "./owner-export";
import type { CloudSyncEnvelope, CloudWordRecord } from "./sync";

function word(over: Partial<CloudWordRecord>): CloudWordRecord {
  return {
    base: "猫",
    state: "learning",
    reading: "ねこ",
    gloss: "cat",
    level: 5,
    freqRank: 100,
    seenCount: 1,
    shownCount: 1,
    firstSeenAt: "2026-06-03T10:00:00.000Z",
    lastSeenAt: "2026-06-04T10:00:00.000Z",
    review: null,
    source: null,
    ...over,
  };
}

function envelope(words: CloudWordRecord[], extra: Partial<CloudSyncEnvelope["snapshot"]> = {}): CloudSyncEnvelope {
  return {
    schemaVersion: 1,
    profile: { id: "user_a", email: null, name: null },
    revision: 7,
    lastSyncedAt: "2026-11-01T00:00:00.000Z",
    webReviews: [{ seq: 1, base: "猫", result: "pass", at: "2026-11-01T00:00:00.000Z" }],
    snapshot: {
      schemaVersion: 1,
      source: "animevocab-extension",
      importedAt: "2026-11-01T00:00:00.000Z",
      sourceExportedAt: null,
      settings: { subLens: true, openaiKey: "sk-secret" },
      words,
      daily: [
        { day: "2026-07-02", met: 3, judged: 2, reviews: 1, watchMin: 20 },
        { day: "2026-05-01", met: 9, judged: 4, reviews: 0, watchMin: 45 },
      ],
      cardTimestamps: [Date.UTC(2026, 6, 2), Date.UTC(2026, 4, 1)],
      ...extra,
    },
  };
}

describe("summarizeBackup", () => {
  it("counts words by state, level, month and show", () => {
    const s = summarizeBackup(
      envelope([
        word({ state: "known", level: 5, source: { title: "Frieren", line: null, en: null } }),
        word({
          state: "learning",
          level: null,
          firstSeenAt: "2026-07-09T00:00:00.000Z",
          lastSeenAt: "2026-08-01T00:00:00.000Z",
          review: { stage: 2, dueAt: null, lapses: 3 },
          source: { title: "Frieren", line: null, en: null },
        }),
        word({ state: "learning", firstSeenAt: null, source: { title: " Bocchi ", line: null, en: null } }),
      ])
    );
    expect(s.words.total).toBe(3);
    expect(s.words.byState).toEqual({ known: 1, learning: 2 });
    expect(s.words.byLevel).toEqual({ "5": 2, unknown: 1 });
    expect(s.words.inReview).toBe(1);
    expect(s.words.totalLapses).toBe(3);
    expect(s.words.addedByMonth).toEqual({ "2026-06": 1, "2026-07": 1 });
    expect(s.words.firstSeenAt).toBe("2026-06-03T10:00:00.000Z");
    expect(s.words.lastSeenAt).toBe("2026-08-01T00:00:00.000Z");
    expect(s.topTitles).toEqual([
      { title: "Frieren", words: 2 },
      { title: "Bocchi", words: 1 },
    ]);
  });

  it("keeps the whole daily history, oldest first", () => {
    const s = summarizeBackup(envelope([]));
    expect(s.daily.map((d) => d.day)).toEqual(["2026-05-01", "2026-07-02"]);
    expect(s.cardsShown).toBe(2);
    expect(s.firstCardAt).toBe("2026-05-01T00:00:00.000Z");
    expect(s.lastCardAt).toBe("2026-07-02T00:00:00.000Z");
    expect(s.revision).toBe(7);
    expect(s.pendingWebReviews).toBe(1);
  });

  it("never exports a stored API key", () => {
    const s = summarizeBackup(envelope([]));
    expect(s.settings).toEqual({ subLens: true });
  });

  it("survives a malformed backup", () => {
    const s = summarizeBackup({ snapshot: {} } as unknown as CloudSyncEnvelope);
    expect(s.words.total).toBe(0);
    expect(s.daily).toEqual([]);
    expect(s.settings).toEqual({});
  });
});

describe("parseMeterKey", () => {
  it("reads listening and every AI bucket", () => {
    expect(parseMeterKey("use:user_abc:2026-10")).toMatchObject({ userId: "user_abc", month: "2026-10", meter: "listeningMinutes" });
    expect(parseMeterKey("ai:usage:user_abc:2026-10")).toMatchObject({ userId: "user_abc", meter: "ai" });
    expect(parseMeterKey("ai:usage:auto:user_abc:2026-10")).toMatchObject({ userId: "user_abc", meter: "auto" });
    expect(parseMeterKey("ai:usage:subs:user_abc:2026-10")).toMatchObject({ userId: "user_abc", meter: "subs" });
  });

  it("ignores everything else", () => {
    expect(parseMeterKey("sync:user:user_abc:snapshot:v1")).toBeNull();
    expect(parseMeterKey("ai:usage:other:user_abc:2026-10")).toBeNull();
    expect(parseMeterKey("use:anon:2026-10")).toBeNull();
  });
});

describe("raw SQL", () => {
  it("reads the full AE window, newest first, capped", () => {
    const sql = rawEventsSql();
    expect(sql).toContain("FROM avc_events");
    expect(sql).toContain(`INTERVAL '${EXPORT_HOURS}' HOUR`);
    expect(sql).toContain("ORDER BY timestamp DESC");
    expect(sql).toContain(`LIMIT ${RAW_ROW_LIMIT}`);
    expect(sql).toContain("_sample_interval");
    expect(sql).not.toMatch(/\bAS\b/);
  });

  it("clamps the limit", () => {
    expect(rawLlmSql(1e9)).toContain(`LIMIT ${RAW_ROW_LIMIT}`);
    expect(rawLlmSql(-5)).toContain("LIMIT 1");
  });

  it("buckets the extension funnel by day", () => {
    expect(extensionFunnelDailySql()).toContain("GROUP BY day, label");
  });
});

describe("nameRows", () => {
  it("renames positional columns and returns oldest first", () => {
    const rows = nameRows(
      [
        { timestamp: "2026-11-02", _sample_interval: "1", blob1: "page", blob2: "home", double1: "12" },
        { timestamp: "2026-11-01", _sample_interval: "4", blob1: "api", blob2: null, double1: "x" },
      ],
      ["kind", "name"],
      ["durationMs"]
    );
    expect(rows).toEqual([
      { timestamp: "2026-11-01", weight: 4, kind: "api", name: "", durationMs: 0 },
      { timestamp: "2026-11-02", weight: 1, kind: "page", name: "home", durationMs: 12 },
    ]);
  });
});

describe("exportFilename", () => {
  it("dates the file", () => {
    expect(exportFilename(new Date("2026-11-17T12:00:00Z"))).toBe("animevocab-usage-2026-11-17.json");
  });
});
