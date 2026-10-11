-- When the iOS Shortcut last synced for this user (naive device-local wall clock, stored like every other timestamp)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sync_at timestamptz
