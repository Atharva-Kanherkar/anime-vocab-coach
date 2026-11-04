-- A self-serve data reset starts a new learner epoch. A device that cached the
-- old epoch discards its copy and pending writes instead of resurrecting them.
ALTER TABLE learn_accounts ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0;
