-- Course data is isolated from legacy vocabulary snapshots and listening quotas.
CREATE TABLE n5_accounts (user_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE n5_enrolments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  track_id TEXT NOT NULL, script TEXT NOT NULL CHECK(script IN ('romaji','kana')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_key)
);
CREATE INDEX n5_enrolments_current ON n5_enrolments(user_id, id DESC);
CREATE TABLE n5_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  episode_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('watch_complete','practice_complete')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_key)
);
CREATE TABLE n5_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
  lesson_id TEXT NOT NULL, content_version TEXT NOT NULL, pack_hash TEXT NOT NULL,
  script TEXT NOT NULL CHECK(script IN ('romaji','kana')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','complete')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 1000001),
  answers_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(answers_json)),
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  mutation_nonce TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, request_key), UNIQUE(id, user_id),
  CHECK((status = 'active' AND result_json IS NULL) OR (status = 'complete' AND result_json IS NOT NULL))
);
CREATE INDEX n5_attempts_user ON n5_attempts(user_id, created_at);
CREATE TABLE n5_answer_requests (
  user_id TEXT NOT NULL, request_key TEXT NOT NULL,
  attempt_id TEXT NOT NULL, fingerprint TEXT NOT NULL, revision INTEGER NOT NULL,
  PRIMARY KEY(user_id, request_key),
  FOREIGN KEY(attempt_id, user_id) REFERENCES n5_attempts(id, user_id) ON DELETE CASCADE
);
CREATE TABLE n5_review_events (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
  objective_id TEXT NOT NULL,
  judgment TEXT NOT NULL CHECK(judgment IN ('review-pass','review-fail')),
  FOREIGN KEY(attempt_id, user_id) REFERENCES n5_attempts(id, user_id) ON DELETE CASCADE
);
