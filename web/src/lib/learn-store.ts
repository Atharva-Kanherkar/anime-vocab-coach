import {
  emptyLearnState,
  projectLearnOp,
  type LearnOp,
  type LearnState,
  type LearnDelta,
} from "./learn-protocol/model";
import { validateLearnOps } from "./learn-protocol/validate";
import type { Notebook } from "./notebooks";

// Structural D1 types keep the domain independent of the Cloudflare runtime.
interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface LearnDB {
  prepare(sql: string): Statement;
  batch<T = Record<string, unknown>>(
    statements: Statement[],
  ): Promise<{ results: T[] }[]>;
}
export class LearnError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const tables = {
  words: "learn_words",
  daily: "learn_daily",
  settings: "learn_settings",
  notebooks: "learn_notebooks",
} as const;
export class LearnStore {
  constructor(
    private db: LearnDB,
    private userId: string,
  ) {}
  private q(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).bind(...args);
  }
  async ensure() {
    await this.q(
      "INSERT INTO learn_accounts(user_id) VALUES(?) ON CONFLICT DO NOTHING",
      this.userId,
    ).run();
  }
  async read(): Promise<{
    state: LearnState;
    revision: number;
    migrated: boolean;
  }> {
    await this.ensure();
    const rows = await this.db.batch([
      this.q(
        "SELECT revision,migrated,deleted FROM learn_accounts WHERE user_id=?",
        this.userId,
      ),
      ...Object.values(tables).map((table) =>
        this.q(`SELECT id,data FROM ${table} WHERE user_id=?`, this.userId),
      ),
      this.q(
        "SELECT notebook_id,id,data FROM learn_notebook_items WHERE user_id=? ORDER BY id",
        this.userId,
      ),
    ]);
    const account = rows[0].results[0];
    if (account.deleted) throw new LearnError("account_deleted", 410);
    const state = emptyLearnState();
    Object.keys(tables).forEach((key, i) => {
      const target = state[key as keyof LearnState] as Record<string, unknown>;
      for (const row of rows[i + 1].results)
        target[String(row.id)] = JSON.parse(String(row.data));
    });
    for (const row of rows[5].results) {
      const notebook = state.notebooks[String(row.notebook_id)];
      if (notebook) notebook.entries.push(JSON.parse(String(row.data)));
    }
    return {
      state,
      revision: Number(account.revision),
      migrated: !!account.migrated,
    };
  }
  async apply(input: LearnOp[], options: { migrated?: boolean } = {}) {
    const ops = validateLearnOps(input);
    for (let attempt = 0; attempt < 8; attempt++) {
      const { state, revision } = await this.read();
      const existing: { results: Record<string, unknown>[] } = { results: [] };
      // D1 allows at most 100 bound parameters per statement.
      for (let i = 0; i < ops.length; i += 50) {
        const page = ops.slice(i, i + 50);
        const rows = await this.q(
          `SELECT op_id,kind,payload,client_ts FROM learn_ops WHERE user_id=? AND op_id IN (${page.map(() => "?").join(",")})`,
          this.userId,
          ...page.map((o) => o.op_id),
        ).all();
        existing.results.push(...rows.results);
      }
      const old = new Map(existing.results.map((r) => [r.op_id, r]));
      const fresh = ops.filter((op) => {
        const prior = old.get(op.op_id);
        if (
          prior &&
          (prior.kind !== op.kind ||
            prior.payload !== JSON.stringify(op.payload) ||
            prior.client_ts !== op.client_ts)
        )
          throw new LearnError("operation_id_reused", 409);
        return !prior;
      });
      if (!fresh.length && !options.migrated)
        return { acknowledged: ops.map((o) => o.op_id) };
      // A mismatched revision deliberately violates the CHECK, rolling back
      // every statement. No review or ack can survive half a transaction.
      const writes = [
        this.q(
          "UPDATE learn_accounts SET revision=CASE WHEN revision=? AND deleted=0 THEN revision+1 ELSE -1 END, migrated=MAX(migrated,?) WHERE user_id=?",
          revision,
          options.migrated ? 1 : 0,
          this.userId,
        ),
      ];
      for (const op of fresh) {
        let delta: LearnDelta;
        try {
          delta = projectLearnOp(state, op);
        } catch (e) {
          throw new LearnError((e as Error).message, 404);
        }
        for (const key of ["words", "daily", "settings"] as const) {
          for (const [id, value] of Object.entries(delta[key] || {}))
            writes.push(
              this.q(
                `INSERT INTO ${tables[key]}(user_id,id,data) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data`,
                this.userId,
                id,
                JSON.stringify(value),
              ),
            );
        }
        for (const [id, nb] of Object.entries(delta.notebooks || {})) {
          if (!nb) {
            writes.push(
              this.q(
                "DELETE FROM learn_notebooks WHERE user_id=? AND id=?",
                this.userId,
                id,
              ),
              this.q(
                "DELETE FROM learn_notebook_items WHERE user_id=? AND notebook_id=?",
                this.userId,
                id,
              ),
            );
          } else {
            writes.push(
              this.q(
                "INSERT INTO learn_notebooks(user_id,id,data) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET data=excluded.data",
                this.userId,
                id,
                JSON.stringify({ ...nb, entries: [] }),
              ),
            );
            if (op.kind === "notebook_item") {
              const entry = op.payload.entry as Notebook["entries"][number];
              writes.push(
                this.q(
                  "INSERT INTO learn_notebook_items(user_id,notebook_id,id,data) VALUES(?,?,?,?) ON CONFLICT(user_id,notebook_id,id) DO UPDATE SET data=excluded.data",
                  this.userId,
                  id,
                  entry.id,
                  JSON.stringify(entry),
                ),
              );
            } else if (op.kind === "notebook_item_delete")
              writes.push(
                this.q(
                  "DELETE FROM learn_notebook_items WHERE user_id=? AND notebook_id=? AND id=?",
                  this.userId,
                  id,
                  op.payload.entryId,
                ),
              );
          }
        }
        if (op.kind === "review" || op.kind === "review_history")
          writes.push(
            this.q(
              "INSERT INTO learn_review_log(user_id,op_id,base,result,client_ts,day) VALUES(?,?,?,?,?,?)",
              this.userId,
              op.op_id,
              op.payload.base,
              op.payload.result,
              op.client_ts,
              op.payload.day,
            ),
          );
        writes.push(
          this.q(
            "INSERT INTO learn_ops(user_id,op_id,kind,payload,client_ts,delta) VALUES(?,?,?,?,?,?)",
            this.userId,
            op.op_id,
            op.kind,
            JSON.stringify(op.payload),
            op.client_ts,
            JSON.stringify(delta),
          ),
        );
      }
      try {
        await this.db.batch(writes);
        return { acknowledged: ops.map((o) => o.op_id) };
      } catch (err) {
        if (
          !String(err).includes("CHECK constraint failed") &&
          !String(err).includes("UNIQUE constraint failed: learn_ops")
        )
          throw err;
      }
    }
    throw new LearnError("concurrent_write_retry", 409);
  }
  async changes(since: number, limit = 100) {
    if (!Number.isSafeInteger(since) || since < 0)
      throw new LearnError("invalid_cursor");
    // Check tombstones before returning any cached data.
    await this.read();
    const { results } = await this.q(
      "SELECT cursor,op_id,delta FROM learn_ops WHERE user_id=? AND cursor>? ORDER BY cursor LIMIT ?",
      this.userId,
      since,
      limit + 1,
    ).all();
    const page = results.slice(0, limit);
    return {
      changes: page.map((r) => ({
        cursor: Number(r.cursor),
        op_id: String(r.op_id),
        delta: JSON.parse(String(r.delta)) as LearnDelta,
      })),
      cursor: page.length ? Number(page[page.length - 1].cursor) : since,
      hasMore: results.length > limit,
    };
  }
  async export() {
    const { state } = await this.read();
    const { results: reviews } = await this.q(
      "SELECT op_id,base,result,client_ts,day FROM learn_review_log WHERE user_id=? ORDER BY rowid",
      this.userId,
    ).all();
    const { results: operations } = await this.q(
      "SELECT op_id,kind,payload,client_ts FROM learn_ops WHERE user_id=? ORDER BY cursor",
      this.userId,
    ).all();
    return {
      schemaVersion: 1,
      ...state,
      reviews,
      operations: operations.map((o) => ({
        ...o,
        payload: JSON.parse(String(o.payload)),
      })),
    };
  }
  async delete() {
    await this.ensure();
    await this.db.batch([
      this.q(
        "UPDATE learn_accounts SET deleted=1,revision=revision+1,migrated=1 WHERE user_id=?",
        this.userId,
      ),
      ...[
        ...Object.values(tables),
        "learn_notebook_items",
        "learn_review_log",
        "learn_ops",
      ].map((t) => this.q(`DELETE FROM ${t} WHERE user_id=?`, this.userId)),
    ]);
  }
}
