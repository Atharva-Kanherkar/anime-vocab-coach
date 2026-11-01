-- Transactional per-item learning data. The revision CHECK is the optimistic
-- transaction guard. A concurrent writer aborts the entire D1 batch and retries.
CREATE TABLE learn_accounts (user_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0), migrated INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0);
CREATE TABLE learn_words (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(user_id,id));
CREATE TABLE learn_daily (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(user_id,id));
CREATE TABLE learn_settings (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(user_id,id));
CREATE TABLE learn_notebooks (user_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(user_id,id));
CREATE TABLE learn_notebook_items (user_id TEXT NOT NULL, notebook_id TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(user_id,notebook_id,id));
CREATE TABLE learn_ops (cursor INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, op_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, client_ts TEXT NOT NULL, delta TEXT NOT NULL, UNIQUE(user_id,op_id));
CREATE INDEX learn_changes ON learn_ops(user_id,cursor);
CREATE TABLE learn_review_log (user_id TEXT NOT NULL, op_id TEXT NOT NULL, base TEXT NOT NULL, result TEXT NOT NULL, client_ts TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY(user_id,op_id));
