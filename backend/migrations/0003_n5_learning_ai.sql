-- Daily per-user budgets for provider-backed course features (audio, feedback, speaking).
CREATE TABLE n5_usage (
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL CHECK(count >= 0),
  PRIMARY KEY(user_id, day, kind)
);
-- One stored typed-answer feedback document per completed attempt.
CREATE TABLE n5_feedback (
  attempt_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  feedback_json TEXT NOT NULL CHECK(json_valid(feedback_json)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY(attempt_id, user_id) REFERENCES n5_attempts(id, user_id) ON DELETE CASCADE
);
-- Speaking practice. Raw audio is never stored, and turns keep validated text only.
CREATE TABLE n5_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  request_key TEXT NOT NULL, lesson_id TEXT NOT NULL, content_version TEXT NOT NULL,
  script TEXT NOT NULL CHECK(script IN ('romaji','kana')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','complete')),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_key), UNIQUE(id, user_id),
  CHECK((status = 'active' AND result_json IS NULL) OR (status = 'complete' AND result_json IS NOT NULL))
);
CREATE INDEX n5_conversations_user ON n5_conversations(user_id, lesson_id, created_at);
CREATE TABLE n5_turns (
  conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, seq INTEGER NOT NULL CHECK(seq >= 0),
  role TEXT NOT NULL CHECK(role IN ('tutor','learner')),
  request_key TEXT, fingerprint TEXT,
  turn_json TEXT NOT NULL CHECK(json_valid(turn_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(conversation_id, seq),
  FOREIGN KEY(conversation_id, user_id) REFERENCES n5_conversations(id, user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX n5_turns_request ON n5_turns(user_id, request_key) WHERE request_key IS NOT NULL;
