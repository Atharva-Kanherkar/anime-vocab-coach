-- Keep bounded retry receipts separate from durable episode observations.
ALTER TABLE n5_events RENAME TO n5_event_requests;
ALTER TABLE n5_event_requests ADD COLUMN response_id TEXT NOT NULL DEFAULT '';
UPDATE n5_event_requests SET response_id=id;
CREATE TABLE n5_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES n5_accounts(user_id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('watch_complete','practice_complete')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, episode_id, kind)
);
INSERT INTO n5_events(id,user_id,episode_id,kind,created_at)
  SELECT id,user_id,episode_id,kind,created_at FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id,episode_id,kind ORDER BY created_at,id) AS position
    FROM n5_event_requests
  ) WHERE position=1;
DELETE FROM n5_event_requests WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY rowid DESC) AS position
    FROM n5_event_requests
  ) WHERE position>1000
);
DELETE FROM n5_enrolments WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY id DESC) AS position
    FROM n5_enrolments
  ) WHERE position>100
);
