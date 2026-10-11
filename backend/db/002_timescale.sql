-- v3: compression + weekly leaderboard continuous aggregate. Safe to re-run.
-- Run via: python scripts/apply_schema.py 002_timescale.sql (no semicolons in comments, the script splits on them)

-- Compress chunks older than 14 days, one segment per user.
ALTER TABLE sleep_sessions SET (timescaledb.compress, timescaledb.compress_segmentby = 'user_id', timescaledb.compress_orderby = 'time DESC');
ALTER TABLE daily_scores SET (timescaledb.compress, timescaledb.compress_segmentby = 'user_id', timescaledb.compress_orderby = 'time DESC');
SELECT add_compression_policy('sleep_sessions', INTERVAL '14 days', if_not_exists => true);
SELECT add_compression_policy('daily_scores', INTERVAL '14 days', if_not_exists => true);

-- One row per user per week. time_bucket('1 week') starts on Monday, matching the weekly leaderboard reset.
-- materialized_only = false: real-time aggregate, so a fresh sync shows up without waiting for a refresh.
CREATE MATERIALIZED VIEW IF NOT EXISTS weekly_leaderboard
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 week', time) AS week, user_id, avg(score) AS avg_score, count(*) AS nights
FROM daily_scores
GROUP BY 1, 2
WITH NO DATA;

SELECT add_continuous_aggregate_policy('weekly_leaderboard',
    start_offset => INTERVAL '3 months', end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour', if_not_exists => true);
CALL refresh_continuous_aggregate('weekly_leaderboard', NULL, NULL);
