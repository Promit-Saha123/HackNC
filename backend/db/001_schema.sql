CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, squad TEXT, source TEXT, is_demo BOOLEAN DEFAULT true);

CREATE TABLE sleep_sessions (time TIMESTAMPTZ NOT NULL, user_id INT REFERENCES users(id), end_time TIMESTAMPTZ, duration_min INT, efficiency REAL, deep_min INT, rem_min INT, light_min INT, awake_min INT, source TEXT);
SELECT create_hypertable('sleep_sessions', 'time');

CREATE TABLE daily_scores (time TIMESTAMPTZ NOT NULL, user_id INT REFERENCES users(id), score REAL, duration_pts REAL, consistency_pts REAL, quality_pts REAL, streak_pts REAL, streak_days INT);
SELECT create_hypertable('daily_scores', 'time');

-- TODO v3: continuous aggregate weekly_leaderboard + compression policy