"""Load the in-memory demo data (app/store.py) into Tiger Cloud.
Run from backend/: python scripts/seed.py  (refuses if users exist; --reset truncates first)."""
import sys
from datetime import datetime, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.config import settings  # noqa: E402
from app.store import Store  # noqa: E402

if not settings.database_url:
    sys.exit("DATABASE_URL is not set in backend/.env")

store = Store()
with psycopg.connect(settings.database_url) as conn:
    if "--reset" in sys.argv:
        conn.execute("TRUNCATE daily_scores, sleep_sessions, users RESTART IDENTITY CASCADE")
    elif conn.execute("SELECT count(*) FROM users").fetchone()[0]:
        sys.exit("users table is not empty; pass --reset to wipe and reseed")
    for u in store.list_users():
        conn.execute(
            "INSERT INTO users (id, name, squad, source, is_demo) VALUES (%s,%s,%s,%s,%s)",
            (u.id, u.name, u.squad, u.source, u.is_demo),
        )
    conn.execute("SELECT setval(pg_get_serial_sequence('users','id'), (SELECT max(id) FROM users))")
    for uid in store.users:
        for n, s in zip(store.nights[uid], store.scores[uid]):
            conn.execute(
                "INSERT INTO sleep_sessions (time, user_id, end_time, duration_min, efficiency, deep_min, rem_min,"
                " light_min, awake_min, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (n.bedtime, uid, n.wake_time, n.duration_min, n.efficiency, n.deep_min, n.rem_min,
                 n.light_min, n.awake_min, n.source),
            )
            conn.execute(
                "INSERT INTO daily_scores (time, user_id, score, duration_pts, consistency_pts, quality_pts,"
                " streak_pts, streak_days) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                (datetime.combine(n.day, time(8)), uid, s.score, s.duration_pts, s.consistency_pts,
                 s.quality_pts, s.streak_pts, s.streak_days),
            )
print(f"seeded {len(store.users)} users")