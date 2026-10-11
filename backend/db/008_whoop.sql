-- One WHOOP connection per user. Tokens are rotated on every refresh (WHOOP invalidates the old refresh token).
-- ponytail: tokens are stored as plain text. Only read:sleep + read:profile are granted, and the DB is access-controlled, but
-- encrypt them (e.g. Fernet keyed from AUTH_SECRET) if this ever holds real users' data.
CREATE TABLE IF NOT EXISTS whoop_connections (
    user_id int PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    whoop_user_id bigint UNIQUE NOT NULL,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamptz NOT NULL,
    scope text,
    connected_at timestamptz NOT NULL DEFAULT now(),
    last_sync_at timestamptz,
    nights_synced int NOT NULL DEFAULT 0
)
