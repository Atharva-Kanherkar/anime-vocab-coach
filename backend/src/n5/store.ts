import type { z } from "zod";
import type { N5Answer, N5Attempt, N5Conversation, N5Enrolment, N5Export, N5ExtensionState, N5Feedback, N5LessonProgress, N5Progress, N5Result, N5ReviewEvent, N5Reviews, N5Script, N5SpeakingResult, N5SpeakingStatus, N5Text, N5Turn } from "../../../shared/n5/contracts";
import { CONTENT_VERSION, COURSE_ID, LESSONS, lessonById, publicLesson, type PrivateLesson } from "./course";
import { type answersSchema, type attemptSchema, type enrolmentSchema, type eventSchema, completeAnswers, fingerprint, grade, packHash, review } from "./domain";

export class CourseError extends Error {
  constructor(readonly code: string, readonly status: number, message: string, readonly allow?: string, readonly details?: { questionId: string }) { super(message); }
}
/** Daily per-user budgets. They bound provider spend; cached audio never counts. */
export const DAILY_LIMITS = { audio: 400, feedback: 30, conversation: 6, turn: 60, grade: 12 } as const;
export type UsageKind = keyof typeof DAILY_LIMITS;

/** Stored turn: both renderings, so a script change never rewrites history. */
export interface StoredTurn {
  role: "tutor" | "learner"; text: N5Text | null; english: string | null;
  input?: "voice" | "text"; raw?: string; tip?: string | null; correction?: N5Text | null;
}
interface ConversationRow { id: string; lesson_id: string; content_version: string; script: N5Script; status: "active" | "complete"; result_json: string | null; request_key: string }
interface TurnRow { seq: number; role: "tutor" | "learner"; request_key: string | null; fingerprint: string | null; turn_json: string }
export const MAX_TURNS = 10;
function publicTurn(row: TurnRow, script: N5Script): N5Turn {
  const turn = JSON.parse(row.turn_json) as StoredTurn;
  return {
    seq: row.seq, role: row.role, text: turn.text?.[script] ?? null, english: turn.english,
    ...(turn.input ? { input: turn.input } : {}),
    ...(row.role === "tutor" ? { tip: turn.tip ?? null, correction: turn.correction?.[script] ?? null } : {}),
    audio: row.role === "tutor" && turn.text !== null,
  };
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
  const answers = JSON.parse(row.answers_json) as N5Answer[];
  const lesson = lessonById(row.lesson_id);
  // Review needs the pinned pack; a retired pack keeps its result but cannot explain answers.
  const reviewable = row.status === "complete" && lesson && row.content_version === CONTENT_VERSION;
  return { id: row.id, courseId: COURSE_ID, lessonId: row.lesson_id, contentVersion: row.content_version,
    script: row.script, revision: row.revision, status: row.status, answers,
    result: row.result_json ? JSON.parse(row.result_json) as N5Result : null,
    ...(reviewable ? { review: review(lesson, answers, row.script) } : {}) };
}
/** Speaking status from finished conversation rows, best evidence first. */
const SPEAKING_RANK: N5SpeakingStatus[] = ["not_started", "practice_only", "needs_practice", "demonstrated"];

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
      "INSERT INTO n5_enrolments(user_id,request_key,fingerprint,track_id,script,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,request_key) DO NOTHING",
      this.userId, body.idempotencyKey, hash, body.trackId, body.script, Date.now()),
      this.statement("DELETE FROM n5_enrolments WHERE user_id=? AND id IN (SELECT id FROM n5_enrolments WHERE user_id=? ORDER BY id DESC LIMIT -1 OFFSET 100)", this.userId, this.userId),
    ]);
    const row = await this.statement("SELECT * FROM n5_enrolments WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<EnrolmentRow>();
    if (!row) conflict();
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
    await this.db.batch([
      this.statement(`INSERT INTO n5_event_requests(id,user_id,request_key,fingerprint,episode_id,kind,created_at,response_id)
        VALUES(?,?,?,?,?,?,?,COALESCE((SELECT id FROM n5_events WHERE user_id=? AND episode_id=? AND kind=?),?))
        ON CONFLICT(user_id,request_key) DO NOTHING`,
      crypto.randomUUID(), this.userId, body.idempotencyKey, hash, body.episodeId, body.kind, Date.now(), this.userId, body.episodeId, body.kind, crypto.randomUUID()),
      // Only the matching receipt can record an observation. Conflicting key
      // reuse cannot add a losing writer's episode/kind as a side effect.
      this.statement(`INSERT INTO n5_events(id,user_id,episode_id,kind,created_at)
        SELECT response_id,user_id,episode_id,kind,created_at FROM n5_event_requests
        WHERE user_id=? AND request_key=? AND fingerprint=?
        ON CONFLICT(user_id,episode_id,kind) DO NOTHING`,
      this.userId, body.idempotencyKey, hash),
      this.statement("DELETE FROM n5_event_requests WHERE user_id=? AND rowid IN (SELECT rowid FROM n5_event_requests WHERE user_id=? ORDER BY rowid DESC LIMIT -1 OFFSET 1000)", this.userId, this.userId),
    ]);
    const receipt = await this.statement("SELECT fingerprint,response_id FROM n5_event_requests WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<{ fingerprint: string; response_id: string }>();
    if (!receipt) conflict();
    checkFingerprint(receipt.fingerprint, hash);
    return { id: receipt.response_id };
  }
  private async row(id: string): Promise<AttemptRow> {
    const row = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND id=?", this.userId, id).first<AttemptRow>();
    if (!row) throw new CourseError("not_found", 404, "Attempt not found.");
    return row;
  }
  private async pack(row: AttemptRow): Promise<PrivateLesson> {
    const lesson = lessonById(row.lesson_id);
    if (!lesson || row.content_version !== CONTENT_VERSION || row.pack_hash !== await packHash(lesson)) {
      throw new CourseError("stale_content", 409, "This attempt needs its original content version.");
    }
    return lesson;
  }
  async create(body: z.infer<typeof attemptSchema>): Promise<N5Attempt> {
    const hash = await fingerprint(body);
    const existing = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<AttemptRow>();
    if (existing) { checkFingerprint(existing.fingerprint, hash); return publicAttempt(existing); }
    const enrolment = await this.enrolment();
    if (!enrolment) throw new CourseError("enrolment_required", 409, "Select a course track first.");
    if (body.script !== undefined && body.script !== enrolment.script)
      throw new CourseError("enrolment_changed", 409, "Your course script changed. Reload the lesson before starting.");
    const pack = await packHash(lessonById(body.lessonId)!);
    // Stale packs remain readable/deletable but cannot block current practice.
    // The bound is atomic even for simultaneous create requests.
    await this.statement(`INSERT INTO n5_attempts(id,user_id,request_key,fingerprint,lesson_id,content_version,pack_hash,script,created_at)
      SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM n5_attempts WHERE user_id=? AND status='active' AND lesson_id=? AND content_version=? AND pack_hash=?) < 5
      AND (SELECT script FROM n5_enrolments WHERE user_id=? ORDER BY id DESC LIMIT 1)=?
      ON CONFLICT(user_id,request_key) DO NOTHING`, crypto.randomUUID(), this.userId, body.idempotencyKey, hash,
      body.lessonId, body.contentVersion, pack, enrolment.script, Date.now(), this.userId, body.lessonId, body.contentVersion, pack, this.userId, enrolment.script).run();
    const row = await this.statement("SELECT * FROM n5_attempts WHERE user_id=? AND request_key=?", this.userId, body.idempotencyKey).first<AttemptRow>();
    if (!row) {
      if ((await this.enrolment())?.script !== enrolment.script)
        throw new CourseError("enrolment_changed", 409, "Your course script changed. Reload the lesson before starting.");
      throw new CourseError("attempt_limit", 429, "Finish or delete an active attempt before starting another.");
    }
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
    const lesson = await this.pack(row);
    const answers = JSON.parse(row.answers_json) as N5Answer[];
    if (!completeAnswers(lesson, answers, row.script)) throw new CourseError("incomplete_answers", 409, "Answer every question before finishing.");
    const result = grade(lesson, answers, row.script);
    const nonce = crypto.randomUUID();
    await this.db.batch([
      this.statement(`UPDATE n5_attempts SET status='complete',result_json=?,revision=revision+1,mutation_nonce=?
        WHERE user_id=? AND id=? AND status='active' AND revision=? AND revision=?`,
      JSON.stringify(result), nonce, this.userId, id, revision, row.revision),
      ...lesson.questions.flatMap((q) => q.kind !== "choice" ? [] : [q]).map((q) => {
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
      this.statement("SELECT id,lesson_id,content_version,pack_hash,status,script,result_json FROM n5_attempts WHERE user_id=? ORDER BY created_at,id", this.userId),
    ]) as [D1Result<N5Enrolment>, D1Result<N5Progress["observations"][number]>, D1Result<Pick<AttemptRow, "id" | "lesson_id" | "content_version" | "pack_hash" | "status" | "script" | "result_json">>];
    const rows = attempts.results.map((row) => ({ ...row, result: typeof row.result_json === "string" ? JSON.parse(row.result_json) as N5Result : null }));
    const speaking = await this.speakingByLesson();
    const lessons: N5LessonProgress[] = [];
    for (const lesson of LESSONS) {
      const mine = rows.filter((row) => row.lesson_id === lesson.id);
      const results = mine.flatMap((row) => (row.result ? [row.result] : []));
      const pack = await packHash(lesson);
      const active = mine.some((row) => row.status === "active" && row.content_version === CONTENT_VERSION && row.pack_hash === pack);
      lessons.push({
        lessonId: lesson.id,
        status: results.some((r) => r.passed) ? "passed" : results.length ? "practised" : active ? "in_progress" : "not_started",
        bestPercent: results.length ? Math.max(...results.map((r) => r.objectivePercent)) : null,
        watched: events.results.some((e) => e.episodeId === lesson.episodeId && e.kind === "watch_complete"),
        speaking: speaking.get(lesson.id) ?? "not_started",
      });
    }
    return { enrolment: enrolments.results[0] ?? null, observations: events.results,
      attempts: rows.map((row) => ({ id: row.id, lessonId: row.lesson_id, status: row.status, script: row.script, result: row.result })),
      lessons, nextLessonId: lessons.find((l) => l.status !== "passed")?.lessonId ?? null, mastery: false };
  }
  /** Best finished speaking evidence per lesson. */
  private async speakingByLesson(): Promise<Map<string, N5SpeakingStatus>> {
    const rows = await this.statement("SELECT lesson_id,result_json FROM n5_conversations WHERE user_id=? AND status='complete'", this.userId).all<{ lesson_id: string; result_json: string }>();
    const best = new Map<string, N5SpeakingStatus>();
    for (const row of rows.results) {
      const status = (JSON.parse(row.result_json) as N5SpeakingResult).status;
      if (SPEAKING_RANK.indexOf(status) > SPEAKING_RANK.indexOf(best.get(row.lesson_id) ?? "not_started")) best.set(row.lesson_id, status);
    }
    return best;
  }
  async extensionState(): Promise<N5ExtensionState> {
    const enrolment = await this.enrolment();
    const progress = enrolment ? await this.progress() : null;
    // Extension focus is for watching, so it follows the next unfinished lesson that has an episode.
    const next = progress ? LESSONS.find((l) => l.episodeId && progress.lessons.find((p) => p.lessonId === l.id)?.status !== "passed") : undefined;
    const lesson = next && enrolment ? publicLesson(next, enrolment.script) : null;
    const pack = next ? await packHash(next) : "";
    const active = next ? await this.statement("SELECT id,script FROM n5_attempts WHERE user_id=? AND status='active' AND lesson_id=? AND content_version=? AND pack_hash=? ORDER BY created_at DESC,id LIMIT 5", this.userId, next.id, CONTENT_VERSION, pack).all<{ id: string; script: N5Script }>() : { results: [] };
    const complete = await this.statement("SELECT COUNT(*) AS n FROM n5_attempts WHERE user_id=? AND status='complete'", this.userId).first<{ n: number }>();
    return {
      apiVersion: 1, ownerId: this.userId,
      context: enrolment && next ? { courseId: COURSE_ID, trackId: enrolment.trackId, unitId: `unit-${next.unit}`, episodeId: next.episodeId!, lessonId: next.id, contentVersion: CONTENT_VERSION, script: enrolment.script } : null,
      lesson: lesson ? { id: lesson.id, contentVersion: lesson.contentVersion, script: lesson.script, canDo: lesson.canDo, unit: lesson.unit, title: lesson.title, episode: lesson.episode,
        vocabulary: lesson.vocabulary.map(({ id, reading, meaning }) => ({ id, reading, meaning })),
        grammar: lesson.grammar.map(({ id, explanation, example }) => ({ id, explanation, example })) } : null,
      watched: Boolean(next && progress?.lessons.find((p) => p.lessonId === next.id)?.watched),
      activeAttempts: active.results, completedAttempts: complete?.n ?? 0, mastery: false,
    };
  }
  /** Atomically consume one unit of a daily budget; false once the limit is reached. */
  async consume(kind: UsageKind): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    const [, counted] = await this.db.batch([this.account(), this.statement(
      `INSERT INTO n5_usage(user_id,day,kind,count) VALUES(?,?,?,1)
       ON CONFLICT(user_id,day,kind) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count`,
      this.userId, day, kind, DAILY_LIMITS[kind])]);
    return (counted.results?.length ?? 0) > 0;
  }
  async storedFeedback(attemptId: string): Promise<N5Feedback | null> {
    const row = await this.statement("SELECT feedback_json FROM n5_feedback WHERE user_id=? AND attempt_id=?", this.userId, attemptId).first<{ feedback_json: string }>();
    return row ? JSON.parse(row.feedback_json) as N5Feedback : null;
  }
  /** First writer wins; a concurrent duplicate returns the stored document. */
  async saveFeedback(feedback: N5Feedback): Promise<N5Feedback> {
    await this.statement("INSERT INTO n5_feedback(attempt_id,user_id,feedback_json,created_at) VALUES(?,?,?,?) ON CONFLICT(attempt_id) DO NOTHING",
      feedback.attemptId, this.userId, JSON.stringify(feedback), Date.now()).run();
    return (await this.storedFeedback(feedback.attemptId)) ?? feedback;
  }
  private async conversationRow(id: string): Promise<ConversationRow> {
    const row = await this.statement("SELECT * FROM n5_conversations WHERE user_id=? AND id=?", this.userId, id).first<ConversationRow>();
    if (!row) throw new CourseError("not_found", 404, "Conversation not found.");
    return row;
  }
  private async turnRows(id: string): Promise<TurnRow[]> {
    return (await this.statement("SELECT seq,role,request_key,fingerprint,turn_json FROM n5_turns WHERE user_id=? AND conversation_id=? ORDER BY seq", this.userId, id).all<TurnRow>()).results;
  }
  async conversation(id: string): Promise<N5Conversation> {
    const row = await this.conversationRow(id);
    const turns = await this.turnRows(id);
    return { id: row.id, lessonId: row.lesson_id, script: row.script, status: row.status, maxLearnerTurns: MAX_TURNS,
      turns: turns.map((t) => publicTurn(t, row.script)), result: row.result_json ? JSON.parse(row.result_json) as N5SpeakingResult : null };
  }
  /** Server-side view for the tutor and grader, including raw transcripts never returned to clients. */
  async conversationContext(id: string): Promise<{ row: ConversationRow; turns: (TurnRow & { turn: StoredTurn })[] }> {
    const row = await this.conversationRow(id);
    return { row, turns: (await this.turnRows(id)).map((t) => ({ ...t, turn: JSON.parse(t.turn_json) as StoredTurn })) };
  }
  /** Resume the lesson's active conversation, or start one with the scripted opener. */
  async startConversation(lesson: PrivateLesson, requestKey: string): Promise<N5Conversation> {
    const replay = await this.statement("SELECT id,lesson_id FROM n5_conversations WHERE user_id=? AND request_key=?", this.userId, requestKey).first<{ id: string; lesson_id: string }>();
    if (replay) { if (replay.lesson_id !== lesson.id) conflict(); return this.conversation(replay.id); }
    const enrolment = await this.enrolment();
    if (!enrolment) throw new CourseError("enrolment_required", 409, "Select a course track first.");
    const active = await this.statement("SELECT id FROM n5_conversations WHERE user_id=? AND lesson_id=? AND content_version=? AND status='active' ORDER BY created_at DESC LIMIT 1", this.userId, lesson.id, CONTENT_VERSION).first<{ id: string }>();
    if (active) return this.conversation(active.id);
    if (!await this.consume("conversation")) throw new CourseError("daily_limit", 429, "You've reached today's speaking practice limit. It resets tomorrow (UTC).");
    const id = crypto.randomUUID();
    const opener: StoredTurn = { role: "tutor", text: lesson.speaking.opener.text, english: lesson.speaking.opener.english, tip: null, correction: null };
    await this.db.batch([
      this.statement("INSERT INTO n5_conversations(id,user_id,request_key,lesson_id,content_version,script,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,request_key) DO NOTHING",
        id, this.userId, requestKey, lesson.id, CONTENT_VERSION, enrolment.script, Date.now()),
      this.statement("INSERT INTO n5_turns(conversation_id,user_id,seq,role,turn_json,created_at) SELECT id,user_id,0,'tutor',?,? FROM n5_conversations WHERE id=? AND user_id=?",
        JSON.stringify(opener), Date.now(), id, this.userId),
    ]);
    const stored = await this.statement("SELECT id FROM n5_conversations WHERE user_id=? AND request_key=?", this.userId, requestKey).first<{ id: string }>();
    if (!stored) conflict();
    return this.conversation(stored.id);
  }
  async replayTurn(requestKey: string, fingerprintValue: string): Promise<string | null> {
    const row = await this.statement("SELECT conversation_id,fingerprint FROM n5_turns WHERE user_id=? AND request_key=?", this.userId, requestKey).first<{ conversation_id: string; fingerprint: string }>();
    if (!row) return null;
    checkFingerprint(row.fingerprint, fingerprintValue);
    return row.conversation_id;
  }
  /** Append a learner turn and the tutor reply in one transaction, only if afterSeq is still the latest turn. */
  async appendTurns(id: string, afterSeq: number, requestKey: string, fingerprintValue: string, learner: StoredTurn, tutor: StoredTurn): Promise<void> {
    try {
      await this.db.batch([
        this.statement(`INSERT INTO n5_turns(conversation_id,user_id,seq,role,request_key,fingerprint,turn_json,created_at)
          SELECT id,user_id,?,'learner',?,?,?,? FROM n5_conversations WHERE id=? AND user_id=? AND status='active'
          AND (SELECT MAX(seq) FROM n5_turns WHERE conversation_id=? AND user_id=?)=?`,
        afterSeq + 1, requestKey, fingerprintValue, JSON.stringify(learner), Date.now(), id, this.userId, id, this.userId, afterSeq),
        this.statement(`INSERT INTO n5_turns(conversation_id,user_id,seq,role,turn_json,created_at)
          SELECT conversation_id,user_id,?,'tutor',?,? FROM n5_turns WHERE conversation_id=? AND user_id=? AND request_key=? AND seq=?`,
        afterSeq + 2, JSON.stringify(tutor), Date.now(), id, this.userId, requestKey, afterSeq + 1),
      ]);
    } catch { conflict(); }
    const saved = await this.statement("SELECT seq FROM n5_turns WHERE user_id=? AND request_key=?", this.userId, requestKey).first<{ seq: number }>();
    if (!saved) conflict();
  }
  async finishConversation(id: string, result: N5SpeakingResult): Promise<void> {
    await this.statement("UPDATE n5_conversations SET status='complete',result_json=? WHERE id=? AND user_id=? AND status='active'", JSON.stringify(result), id, this.userId).run();
  }
  async abandonConversation(id: string): Promise<{ deleted: true }> {
    await this.conversationRow(id);
    const deleted = await this.statement("DELETE FROM n5_conversations WHERE id=? AND user_id=? AND status='active' RETURNING id", id, this.userId).first<{ id: string }>();
    if (!deleted) conflict();
    return { deleted: true };
  }
  async reviews(): Promise<N5Reviews> {
    const rows = await this.statement("SELECT id,attempt_id AS attemptId,objective_id AS objectiveId,judgment FROM n5_review_events WHERE user_id=? ORDER BY id", this.userId).all<N5ReviewEvent>();
    return { events: rows.results, consumerStatus: "not_integrated" };
  }
  async exportData(): Promise<N5Export> {
    const result = await this.db.batch<Record<string, unknown>>([
      this.statement("SELECT track_id AS trackId,script,created_at AS createdAt FROM n5_enrolments WHERE user_id=? ORDER BY id", this.userId),
      this.statement("SELECT episode_id AS episodeId,kind,created_at AS createdAt FROM n5_events WHERE user_id=? ORDER BY created_at,id", this.userId),
      this.statement("SELECT json_object('id',id,'courseId',?,'lessonId',lesson_id,'contentVersion',content_version,'script',script,'revision',revision,'status',status,'answers',json(answers_json),'result',json(result_json)) AS payload FROM n5_attempts WHERE user_id=? ORDER BY created_at,id", COURSE_ID, this.userId),
      this.statement("SELECT id,attempt_id AS attemptId,objective_id AS objectiveId,judgment FROM n5_review_events WHERE user_id=? ORDER BY id", this.userId),
    ]) as [D1Result<N5Export["enrolments"][number]>, D1Result<N5Export["observations"][number]>, D1Result<{ payload: string }>, D1Result<N5Export["reviews"][number]>];
    const conversations = (await this.statement("SELECT id FROM n5_conversations WHERE user_id=? ORDER BY created_at,id", this.userId).all<{ id: string }>()).results;
    const feedback = (await this.statement("SELECT feedback_json FROM n5_feedback WHERE user_id=? ORDER BY created_at,attempt_id", this.userId).all<{ feedback_json: string }>()).results;
    return { apiVersion: 1, enrolments: result[0].results, observations: result[1].results,
      attempts: result[2].results.map((row) => JSON.parse(String(row.payload)) as N5Attempt), reviews: result[3].results,
      conversations: await Promise.all(conversations.map((c) => this.conversation(c.id))),
      feedback: feedback.map((f) => JSON.parse(f.feedback_json) as N5Feedback) };
  }
  async deleteData(): Promise<void> {
    await this.statement("DELETE FROM n5_accounts WHERE user_id=?", this.userId).run();
  }
}
