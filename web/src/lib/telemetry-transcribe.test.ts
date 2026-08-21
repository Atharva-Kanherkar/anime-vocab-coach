import { describe, expect, it } from "vitest";
import {
  TRANSCRIBE_BLOBS,
  TRANSCRIBE_DATASET,
  TRANSCRIBE_DOUBLES,
  TRANSCRIBE_OUTCOMES,
  transcribeColumn,
} from "./telemetry-schema";
import {
  eventDistinctUsersSql,
  llmDistinctUsersSql,
  transcribeByUserSql,
  transcribeGroupSql,
  transcribeSeriesSql,
  transcribeTotalsSql,
} from "./telemetry-query";
import { fmtMinutes } from "./owner-history";

/**
 * Analytics Engine has no schema: SQL addresses columns positionally as
 * blob1..blob20 / double1..double20. A reader that disagrees with the writer
 * about which position holds which field produces confidently wrong numbers
 * with no error anywhere. These tests pin the mapping and the shape of the
 * generated SQL, since the SQL itself is only validated by the remote API at
 * runtime.
 */
describe("transcribeColumn", () => {
  it("maps every blob to its 1-based position", () => {
    TRANSCRIBE_BLOBS.forEach((name, i) => {
      expect(transcribeColumn(name)).toBe(`blob${i + 1}`);
    });
  });

  it("maps every double to its 1-based position", () => {
    TRANSCRIBE_DOUBLES.forEach((name, i) => {
      expect(transcribeColumn(name)).toBe(`double${i + 1}`);
    });
  });

  it("throws on an unknown field rather than silently picking a column", () => {
    // @ts-expect-error deliberately outside the union
    expect(() => transcribeColumn("nope")).toThrow();
  });

  it("pins the positions the deployed writer is already using", () => {
    // Hard-coded on purpose. If someone reorders the arrays, the loops above
    // still pass (they derive from the same source) but this fails, which is
    // the whole point: historical rows keep the old positions forever.
    expect(transcribeColumn("provider")).toBe("blob1");
    expect(transcribeColumn("userId")).toBe("blob3");
    expect(transcribeColumn("outcome")).toBe("blob9");
    expect(transcribeColumn("audioMinutes")).toBe("double1");
    expect(transcribeColumn("costUsd")).toBe("double2");
    expect(transcribeColumn("monthMinutesAfter")).toBe("double5");
  });
});

/** Arguments of each top-level `SUM(...)`, respecting nested parentheses. */
function sumArguments(sql: string): string[] {
  const out: string[] = [];
  for (let i = sql.indexOf("SUM("); i !== -1; i = sql.indexOf("SUM(", i + 1)) {
    let depth = 0;
    for (let j = i + 3; j < sql.length; j++) {
      if (sql[j] === "(") depth++;
      else if (sql[j] === ")") {
        depth--;
        if (depth === 0) {
          out.push(sql.slice(i + 4, j));
          break;
        }
      }
    }
  }
  return out;
}

describe("transcription SQL", () => {
  it("reads from the transcription dataset, not the LLM one", () => {
    for (const sql of [
      transcribeTotalsSql(24),
      transcribeGroupSql("provider", 24),
      transcribeSeriesSql(24),
      transcribeByUserSql(24),
    ]) {
      expect(sql).toContain(TRANSCRIBE_DATASET);
      expect(sql).not.toContain("avc_llm");
    }
  });

  it("weights every aggregate by _sample_interval", () => {
    // AE samples writes under load and stores the weight per row, so an
    // unweighted SUM under-reports both usage and spend. Nested calls like
    // SUM(IF(x IN ('a','b'), ...)) mean a naive /SUM\(([^)]*)\)/ truncates at
    // the first ')' and reports a false failure, so match balanced parens.
    const sql = transcribeTotalsSql(24);
    const sums = sumArguments(sql);
    expect(sums.length).toBeGreaterThan(4);
    for (const arg of sums) {
      expect(arg, `unweighted aggregate: SUM(${arg})`).toContain("_sample_interval");
    }
  });

  it("splits billable provider calls from free cache hits", () => {
    const sql = transcribeTotalsSql(24);
    // Without both halves the hit rate has no denominator.
    expect(sql).toContain("provider_call");
    expect(sql).toContain("cache_hit");
    expect(sql).toContain("peer_hit");
    expect(sql).toContain("providerCalls");
    expect(sql).toContain("hits");
  });

  it("scopes to a single user when asked, with the value quoted", () => {
    const sql = transcribeTotalsSql(24, "user_abc");
    expect(sql).toContain(`${transcribeColumn("userId")} = 'user_abc'`);
  });

  it("escapes quotes in a user id instead of breaking out of the literal", () => {
    const sql = transcribeTotalsSql(24, "user_'; DROP TABLE x; --");
    // The payload's own quote must be backslash-escaped, so it cannot close
    // the literal. Checking for the absence of the raw substring is not a
    // valid test: it survives escaping, just preceded by a backslash.
    expect(sql).toContain("\\'");
    expect(sql).not.toMatch(/[^\\]'; DROP/);
    // And the literal must be balanced: an odd number of unescaped quotes
    // would mean the payload broke out of it.
    const unescaped = [...sql.matchAll(/(^|[^\\])'/g)].length;
    expect(unescaped % 2, "unbalanced string literal").toBe(0);
  });

  it("clamps the hours interval to a positive integer", () => {
    for (const bad of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const sql = transcribeTotalsSql(bad);
      const m = /INTERVAL '(\d+)' HOUR/.exec(sql);
      expect(m, `no clean interval for ${bad}`).toBeTruthy();
      expect(Number(m![1])).toBeGreaterThan(0);
    }
  });

  it("clamps the group limit to a positive integer", () => {
    for (const bad of [0, -3, 2.7]) {
      const sql = transcribeGroupSql("provider", 24, bad);
      const m = /LIMIT (\d+)/.exec(sql);
      expect(m).toBeTruthy();
      expect(Number(m![1])).toBeGreaterThan(0);
    }
  });

  it("tracks the running monthly total with MAX, for cap headroom", () => {
    // SUM would multiply a running total by the number of chunks.
    expect(transcribeByUserSql(24)).toContain(
      `MAX(${transcribeColumn("monthMinutesAfter")})`
    );
  });

  /**
   * Regression pin for a 422 that typechecking cannot catch.
   *
   * Analytics Engine rejects IF() when the branches differ in type:
   *   "the 2nd and 3rd arguments to IF() function must have the same type
   *    but instead had Double and Integer"
   * `SUM(IF(cond, doubleCol * _sample_interval, 0))` therefore fails the whole
   * query, taking every stat in the panel with it, while the integer-counting
   * form with `0` is fine. Only running the SQL against the real API surfaced
   * it, so this test encodes the rule instead.
   */
  it("uses a float zero in conditional branches that produce a double", () => {
    for (const sql of [transcribeTotalsSql(24), transcribeGroupSql("provider", 24)]) {
      for (const arg of sumArguments(sql)) {
        if (!arg.startsWith("IF(")) continue;
        const isDoubleBranch = /double\d+\s*\*/.test(arg);
        const fallback = arg.slice(arg.lastIndexOf(",") + 1).trim().replace(/\)+$/, "");
        if (isDoubleBranch) {
          expect(fallback, `double branch needs 0.0: SUM(${arg})`).toBe("0.0");
        } else {
          expect(fallback, `count branch needs 0: SUM(${arg})`).toBe("0");
        }
      }
    }
  });

  it("knows every outcome the writer can emit", () => {
    expect([...TRANSCRIBE_OUTCOMES]).toEqual([
      "provider_call",
      "cache_hit",
      "peer_hit",
      "cap_exceeded",
      "provider_error",
    ]);
  });
});

describe("distinct-user SQL", () => {
  it("counts distinct users without grouping", () => {
    // The facets query is grouped, so summing its per-group DISTINCTs would
    // double-count anyone appearing in two groups. That is why these are
    // separate ungrouped queries rather than another column on the facets.
    for (const sql of [llmDistinctUsersSql(24), eventDistinctUsersSql(24)]) {
      expect(sql).toContain("COUNT(DISTINCT");
      expect(sql).not.toContain("GROUP BY");
    }
  });

  it("excludes the anonymous bucket so it is not counted as a person", () => {
    for (const sql of [llmDistinctUsersSql(24), eventDistinctUsersSql(24)]) {
      expect(sql).toContain("!= 'anon'");
      expect(sql).toContain("!= ''");
    }
  });
});

describe("fmtMinutes", () => {
  it("renders sub-minute audio as seconds", () => {
    expect(fmtMinutes(0.5)).toBe("30s");
    expect(fmtMinutes(0.08)).toBe("5s");
  });

  it("renders minutes and hours", () => {
    expect(fmtMinutes(17.22)).toBe("17m");
    expect(fmtMinutes(103.97)).toBe("1h 44m");
    expect(fmtMinutes(60)).toBe("1h 00m");
  });

  it("treats zero and nonsense as zero rather than NaN", () => {
    expect(fmtMinutes(0)).toBe("0m");
    expect(fmtMinutes(-3)).toBe("0m");
    expect(fmtMinutes(Number.NaN)).toBe("0m");
  });
});
