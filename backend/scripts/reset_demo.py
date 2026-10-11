"""Reset the 8 demo friends to fresh seed data ending TODAY, without touching any real account.
Run from backend/:  python scripts/reset_demo.py            (do it)
                    python scripts/reset_demo.py --dry-run  (show what would change, change nothing)
seed.py --reset truncates every table, real accounts included. This rewrites only the demo profiles' rows (matched by their
seed names), puts their profile/settings back to defaults, and refreshes the weekly aggregate. Run it after a demo, or
each morning so the demo friends' "last night" is current."""
import argparse
import sys
from datetime import date, datetime, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.config import settings  # noqa: E402
from app.store import DEMO_SQUAD_CODES, Store  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--dry-run", action="store_true")
args = ap.parse_args()
if not settings.database_url:
    sys.exit("DATABASE_URL is not set in backend/.env")

seed = Store(today=date.today())  # the same generator the app was seeded with, shifted to end today
names = [u.name for u in seed.list_users()]

with psycopg.connect(settings.database_url) as conn:  # one transaction: all 8 friends reset, or none
    real_before = conn.execute("SELECT count(*) FROM users WHERE NOT (name = ANY(%s))", (names,)).fetchone()[0]
    ids = dict(conn.execute("SELECT name, id FROM users WHERE name = ANY(%s)", (names,)).fetchall())
    for code_name, code in DEMO_SQUAD_CODES.items():
        conn.execute("INSERT INTO squads (name, code) VALUES (%s, %s) ON CONFLICT DO NOTHING", (code_name, code))
    deleted = inserted = 0
    for sid, user in seed.users.items():
        if user.name not in ids:  # a demo friend that was deleted: bring them back
            ids[user.name] = conn.execute(
                "INSERT INTO users (name, squad, source, is_demo) VALUES (%s, %s, 'seed', true) RETURNING id",
                (user.name, user.squad),
            ).fetchone()[0]
        uid = ids[user.name]
        deleted += conn.execute("DELETE FROM sleep_sessions WHERE user_id = %s", (uid,)).rowcount
        conn.execute("DELETE FROM daily_scores WHERE user_id = %s", (uid,))
        conn.execute(
            "UPDATE users SET squad = %s, source = 'seed', is_demo = true, password_hash = NULL, last_sync_at = NULL,"
            " goal_bedtime = 1365, goal_wake = 420, goal_hours = 8, share_details = true, show_on_board = true,"
            " avatar = NULL, bio = NULL WHERE id = %s", (user.squad, uid),
        )
        cur = conn.cursor()
        cur.executemany(
            "INSERT INTO sleep_sessions (time, user_id, end_time, duration_min, efficiency, deep_min, rem_min,"
            " light_min, awake_min, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            [(n.bedtime, uid, n.wake_time, n.duration_min, n.efficiency, n.deep_min, n.rem_min, n.light_min,
              n.awake_min, n.source) for n in seed.nights[sid]],
        )
        cur.executemany(
            "INSERT INTO daily_scores (time, user_id, score, duration_pts, consistency_pts, quality_pts, streak_pts,"
            " streak_days) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            [(datetime.combine(n.day, time(8)), uid, s.score, s.duration_pts, s.consistency_pts, s.quality_pts,
              s.streak_pts, s.streak_days) for n, s in zip(seed.nights[sid], seed.scores[sid])],
        )
        inserted += len(seed.nights[sid])
    real_after = conn.execute("SELECT count(*) FROM users WHERE NOT (name = ANY(%s))", (names,)).fetchone()[0]
    assert real_before == real_after, "a non-demo account changed, rolling back"
    print(f"{'DRY RUN: ' if args.dry_run else ''}reset {len(seed.users)} demo friends: "
          f"{deleted} old nights replaced by {inserted} fresh ones ending {date.today()}; {real_after} real account(s) untouched")
    if args.dry_run:
        conn.rollback()

if not args.dry_run:  # outside the transaction: the aggregate refresh can't run inside one
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute("CALL refresh_continuous_aggregate('weekly_leaderboard', NULL, NULL)")
    print("weekly leaderboard aggregate refreshed")
