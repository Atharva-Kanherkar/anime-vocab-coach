-- Lesson words Listening Mode heard in the episode audio. Word ids only: the
-- dialogue itself is never stored.
CREATE TABLE n5_heard (
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL, word_id TEXT NOT NULL,
  first_heard_at INTEGER NOT NULL, last_heard_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, lesson_id, word_id)
);
