-- Real-user scale. Safe to re-run. Timescale only indexes time by default, so per-user lookups (overview, history,
-- streaks, rescoring) would scan every user's rows. These make them index reads.
CREATE INDEX IF NOT EXISTS daily_scores_user_time ON daily_scores (user_id, time DESC);
CREATE INDEX IF NOT EXISTS sleep_sessions_user_end ON sleep_sessions (user_id, end_time DESC);
CREATE INDEX IF NOT EXISTS users_squad_lower ON users (lower(squad));

-- One night per user per day: 7-day chunks leave ~7 rows per user per chunk, which compresses badly (0.8x measured).
-- 90-day chunks apply to NEW chunks only, existing ones keep their length.
SELECT set_chunk_time_interval('sleep_sessions', INTERVAL '90 days');
SELECT set_chunk_time_interval('daily_scores', INTERVAL '90 days')
