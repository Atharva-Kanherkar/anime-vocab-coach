import type { z } from "zod";
import type { N5Answer, N5Attempt, N5Enrolment, N5Export, N5Progress, N5Result, N5ReviewEvent, N5Reviews, N5Script } from "../../../shared/n5/contracts";
import { CONTENT_VERSION, COURSE_ID, LESSON_ID, QUESTIONS } from "./content";
import { type answersSchema, type attemptSchema, type enrolmentSchema, type eventSchema, completeAnswers, fingerprint, grade } from "./domain";

export class CourseError extends Error {
  constructor(readonly code: string, readonly status: number, message: string, readonly allow?: string) { super(message); }
}
interface EnrolmentRow { track_id: string; script: N5Script; fingerprint: string }
interface AttemptRow {
  id: string; lesson_id: string; content_version: string; pack_hash: string; script: N5Script;
  status: "active" | "complete"; revision: number; answers_json: string; result_json: string | null;
  fingerprint: string;
}
interface Receipt { fingerprint: string; revision: number; attempt_id: string }

function conflict(): never { throw new CourseError("conflict", 409, "Request conflicts with saved state; refresh before retrying."); }
function checkFingerprint(actual: string, expected: string): void { if (actual !== expected) conflict(); }
function publicAttempt(row: AttemptRow): N5Attempt {
  return { id: row.id, courseId: COURSE_ID, lessonId: row.lesson_id, contentVersion: row.content_version,
    script: row.script, revision: row.revision, status: row.status, answers: JSON.parse(row.answers_json) as N5Answer[],
    result: row.result_json ? JSON.parse(row.result_json) as N5Result : null };
}

/** One primary-anchored session per request gives read-after-write consistency with D1 replicas. */
export class CourseStore {
  constructor(private readonly db: D1DatabaseSession, private readonly userId: string) {}
  private statement(sql: string, ...values: unknown[]): D1PreparedStatement { return this.db.prepare(sql).bind(...values); }
  private account(): D1PreparedStatement {
    return this.statement("INSERT INTO n5_accounts(user_id,created_at) VALUES(?,?) ON CONFLICT DO NOTHING", this.userId, Date.now());
  }
  async enrol(body: z.infer<typeof enrolmentSchema>): Promise<{ trackId: string; script: N5Script }> {
    const hash = await fingerprint(body);
    await this.db.batch([this.account(), this.statement(
      "INSERT INTO n5_enrolments(user_id,request_key,fingerprint,track_id,script,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM n5_enrolments WHERE user_id=?) < 100 ON CONFLICT(user_id,request_key) DO NOTHING",
      this.userId, body.idempotencyKey, hash, body.trackId, body.script, Date.now(), this.userId)]);
    const row = await this.statement("SELECT * FROM n5_enrolments WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<EnrolmentRow>();
    if (!row) throw new CourseError("enrolment_limit", 429, "Enrolment preference history is full.");
    checkFingerprint(row.fingerprint, hash);
    return { trackId: row.track_id, script: row.script };
  }
  async enrolment(): Promise<{ trackId: string; script: N5Script } | null> {
    const row = await this.statement("SELECT * FROM n5_enrolments WHERE user_id=? ORDER BY id DESC LIMIT 1", this.userId).first<EnrolmentRow>();
    return row ? { trackId: row.track_id, script: row.script } : null;
  }
  async observe(body: z.infer<typeof eventSchema>): Promise<{ id: string }> {
    if (!await this.enrolment()) throw new CourseError("enrolment_required", 409, "Select a course track first.");
    const hash = await fingerprint(body);
    await this.statement("INSERT INTO n5_events(id,user_id,request_key,fingerprint,episode_id,kind,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM n5_events WHERE user_id=?) < 1000 ON CONFLICT(user_id,request_key) DO NOTHING",
      crypto.randomUUID(), this.userId, body.idempotencyKey, hash, body.episodeId, body.kind, Date.now(), this.userId).run();
    const row = await this.statement("SELECT id,fingerprint FROM n5_events WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<{ id: string; fingerprint: string }>();
    if (!row) throw new CourseError("event_limit", 429, "Observation history is full.");
    checkFingerprint(row.fingerprint, hash);
    return { id: row.id };
  }
  private async row(id: string): Promise<AttemptRow> {
    const row = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND id=?", this.userId, id).first<AttemptRow>();
    if (!row) throw new CourseError("not_found", 404, "Attempt not found.");
    return row;
  }
  private async pack(row: AttemptRow): Promise<void> {
    if (row.lesson_id !== LESSON_ID || row.content_version !== CONTENT_VERSION || row.pack_hash !== await fingerprint(QUESTIONS)) {
      throw new CourseError("stale_content", 409, "This attempt needs its original content version.");
    }
  }
  async create(body: z.infer<typeof attemptSchema>): Promise<N5Attempt> {
    const hash = await fingerprint(body);
    const existing = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<AttemptRow>();
    if (existing) { checkFingerprint(existing.fingerprint, hash); return publicAttempt(existing); }
    const enrolment = await this.enrolment();
    if (!enrolment) throw new CourseError("enrolment_required", 409, "Select a course track first.");
    const packHash = await fingerprint(QUESTIONS);
    // Stale packs remain readable/deletable but cannot block current practice.
    // The bound is atomic even for simultaneous create requests.
    await this.statement(`INSERT INTO n5_attempts(id,user_id,request_key,fingerprint,lesson_id,content_version,pack_hash,script,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM n5_attempts WHERE user_id=? AND status='active' AND lesson_id=? AND content_version=? AND pack_hash=?) < 5
      ON CONFLICT(user_id,request_key) DO NOTHING`, crypto.randomUUID(), this.userId, body.idempotencyKey, hash,
      body.lessonId, body.contentVersion, packHash, enrolment.script, Date.now(), this.userId, body.lessonId, body.contentVersion, packHash).run();
    const row = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<AttemptRow>();
    if (!row) throw new CourseError("attempt_limit", 429, "Finish or delete an active attempt before starting another.");
    checkFingerprint(row.fingerprint, hash);
    return publicAttempt(row);
  }
  async abandon(id: string): Promise<{ deleted: true }> {
    await this.row(id); // Owner check does not require the original pack.
    const deleted = await this.statement("DELETE FROM n5_attempts WHERE id=? AND user_id=? AND status='active' RETURNING id", id, this.userId).first<{ id: string }>();
    if (!deleted) conflict(); // A completed result must survive a finish/delete race.
    return { deleted: true };
  }
  async get(id: string): Promise<N5Attempt> { return publicAttempt(await this.row(id)); }
  async saveAnswers(id: string, body: z.infer<typeof answersSchema>): Promise<{ attemptId: string; revision: number }> {
    const row = await this.row(id);
    await this.pack(row);
    const hash = await fingerprint({ attemptId: id, ...body });
    const nonce = crypto.randomUUID();
    // The receipt insert is guarded by the CAS winner's nonce. A losing writer cannot record success.
    await this.db.batch([
      this.statement(`UPDATE n5_attempts SET answers_json=?, revision=revision+1, mutation_nonce=?
        WHERE id=? AND user_id=? AND status='active' AND revision=?
        AND NOT EXISTS(SELECT 1 FROM n5_answer_requests WHERE user_id=? AND request_key=?)`,
      JSON.stringify(body.answers), nonce, id, this.userId, body.revision, this.userId, body.idempotencyKey),
      this.statement(`INSERT INTO n5_answer_requests(user_id,request_key,attempt_id,fingerprint,revision)
        SELECT user_id,?,id,?,revision FROM n5_attempts WHERE id=? AND user_id=? AND mutation_nonce=?`,
      body.idempotencyKey, hash, id, this.userId, nonce),
    ]);
    const receipt = await this.statement("SELECT * FROM n5_answer_requests WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<Receipt>();
    if (!receipt) conflict();
    checkFingerprint(receipt.fingerprint, hash);
    return { attemptId: receipt.attempt_id, revision: receipt.revision };
  }
  async finish(id: string, revision: number): Promise<N5Attempt> {
    const row = await this.row(id);
    if (row.status === "complete") return publicAttempt(row);
    await this.pack(row);
    const answers = JSON.parse(row.answers_json) as N5Answer[];
    if (!completeAnswers(answers, row.script)) throw new CourseError("incomplete_answers", 409, "Answer every question before finishing.");
    const result = grade(answers, row.script);
    const nonce = crypto.randomUUID();
    await this.db.batch([
      this.statement(`UPDATE n5_attempts SET status='complete',result_json=?,revision=revision+1,mutation_nonce=?
        WHERE user_id=? AND id=? AND status='active' AND revision=? AND revision=?`,
      JSON.stringify(result), nonce, this.userId, id, revision, row.revision),
      ...QUESTIONS.filter((q) => q.kind === "choice").map((q) => {
        const passed = answers.some((a) => a.questionId === q.id && a.value === q.correctOption);
        return this.statement(`INSERT INTO n5_review_events(id,user_id,attempt_id,objective_id,judgment)
          SELECT ?,user_id,id,?,? FROM n5_attempts WHERE id=? AND user_id=? AND mutation_nonce=? AND status='complete'`,
        `${id}:${q.id}`, q.objectiveId, passed ? "review-pass" : "review-fail", id, this.userId, nonce);
      }),
    ]);
    const finished = await this.row(id);
    if (finished.status !== "complete") conflict();
    return publicAttempt(finished);
  }
  async progress(): Promise<N5Progress> {
    const [enrolments, events, attempts] = await this.db.batch<Record<string, unknown>>([
      this.statement("SELECT track_id AS trackId,script FROM n5_enrolments WHERE user_id=? ORDER BY id DESC LIMIT 1", this.userId),
      this.statement("SELECT DISTINCT episode_id AS episodeId,kind FROM n5_events WHERE user_id=? ORDER BY episode_id,kind", this.userId),
      this.statement("SELECT id,status,script,result_json FROM n5_attempts WHERE user_id=? ORDER BY created_at,id", this.userId),
    ]) as [D1Result<N5Enrolment>, D1Result<N5Progress["observations"][number]>, D1Result<Pick<AttemptRow, "id" | "status" | "script" | "result_json">>];
    return { enrolment: enrolments.results[0] ?? null, observations: events.results,
      attempts: attempts.results.map((row) => ({ id: row.id, status: row.status, script: row.script,
        result: typeof row.result_json === "string" ? JSON.parse(row.result_json) as N5Result : null })), mastery: false };
  }
  async reviews(): Promise<N5Reviews> {
    const rows = await this.statement("SELECT id,attempt_id AS attemptId,objective_id AS objectiveId,judgment FROM n5_review_events WHERE user_id=? ORDER BY id", this.userId).all<N5ReviewEvent>();
    return { events: rows.results, consumerStatus: "not_integrated" };
  }
  async exportData(): Promise<N5Export> {
    const result = await this.db.batch<Record<string, unknown>>([
      this.statement("SELECT track_id,script,created_at FROM n5_enrolments WHERE user_id=? ORDER BY id", this.userId),
      this.statement("SELECT episode_id,kind,created_at FROM n5_events WHERE user_id=? ORDER BY created_at,id", this.userId),
      this.statement("SELECT json_object('id',id,'courseId',?,'lessonId',lesson_id,'contentVersion',content_version,'script',script,'revision',revision,'status',status,'answers',json(answers_json),'result',json(result_json)) AS payload FROM n5_attempts WHERE user_id=? ORDER BY created_at,id", COURSE_ID, this.userId),
      this.statement("SELECT id,attempt_id,objective_id,judgment FROM n5_review_events WHERE user_id=? ORDER BY id", this.userId),
    ]) as [D1Result<N5Export["enrolments"][number]>, D1Result<N5Export["observations"][number]>, D1Result<{ payload: string }>, D1Result<N5Export["reviews"][number]>];
    return { apiVersion: 1, enrolments: result[0].results, observations: result[1].results,
      attempts: result[2].results.map((row) => JSON.parse(String(row.payload)) as N5Attempt), reviews: result[3].results };
  }
  async deleteData(): Promise<void> {
    await this.statement("DELETE FROM n5_accounts WHERE user_id=?", this.userId).run();
  }
}
