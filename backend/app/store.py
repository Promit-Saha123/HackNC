"""Two stores with the same methods: Store (in-memory, 8 seeded friends x 60 nights, used when DATABASE_URL
is unset and by scripts/seed.py) and SqlStore (Tiger Cloud). `store` at the bottom picks one."""
import random
from datetime import date, datetime, time, timedelta
from statistics import mean

from .config import settings
from .db import get_pool
from .models import Leaderboard, LeaderboardEntry, NightScore, Overview, ScoreBreakdown, SleepNight, User
from .scoring import badge_for, compute_scores

SEED_DAYS = 60

# name, squad, usual bedtime (hours after midnight: 23.0 = 11pm, 26.0 = 2am), hours asleep, pattern
PROFILES = [
    ("Maya", "Wolfpack", 22.75, 8.0, "steady"),  # perfect sleeper
    ("Jordan", "Wolfpack", 23.25, 7.4, "weekend"),  # weekend drift
    ("Sam", "Wolfpack", 23.5, 7.5, "exam"),  # exam-week crash
    ("Riley", "Night Owls", 26.0, 6.8, "steady"),  # night owl
    ("Alex", "Night Owls", 25.0, 5.8, "improving"),  # climbing out of all-nighters
    ("Priya", "Night Owls", 23.0, 7.8, "steady"),
    ("Chris", "Library Rats", 24.0, 7.0, "weekend"),
    ("Dana", "Library Rats", 24.25, 6.8, "steady"),
]


def _gen_nights(uid: int, bed_h: float, sleep_h: float, kind: str, today: date) -> list[SleepNight]:
    rng = random.Random(uid)
    nights = []
    for i in range(SEED_DAYS):
        day = today - timedelta(days=SEED_DAYS - 1 - i)
        bed_min = bed_h * 60 + rng.gauss(0, 12)
        hours = sleep_h + rng.gauss(0, 0.3)
        if kind == "weekend" and day.weekday() in (5, 6):  # wake-up Sat/Sun = Fri/Sat night out
            bed_min += 120
            hours += 0.8
        elif kind == "exam" and i >= SEED_DAYS - 10:
            bed_min += 150
            hours -= 2.5
        elif kind == "improving":
            t = i / (SEED_DAYS - 1)
            bed_min -= 90 * t
            hours += 2.0 * t
        eff = min(0.98, max(0.75, rng.gauss(0.91, 0.03)))
        asleep = int(max(180, hours * 60))
        in_bed = round(asleep / eff)
        bed = datetime.combine(day - timedelta(days=1), time()) + timedelta(minutes=bed_min)
        deep, rem = round(asleep * rng.uniform(0.14, 0.20)), round(asleep * rng.uniform(0.19, 0.25))
        nights.append(
            SleepNight(
                day=day,
                bedtime=bed,
                wake_time=bed + timedelta(minutes=in_bed),
                duration_min=asleep,
                efficiency=round(asleep / in_bed, 3),
                deep_min=deep,
                rem_min=rem,
                light_min=asleep - deep - rem,
                awake_min=in_bed - asleep,
                source="seed",
            )
        )
    return nights


class Store:
    def __init__(self, today: date | None = None):
        today = today or date.today()
        self.users: dict[int, User] = {}
        self.nights: dict[int, list[SleepNight]] = {}
        self.scores: dict[int, list] = {}
        self.hashes: dict[int, str] = {}
        for uid, (name, squad, bed_h, sleep_h, kind) in enumerate(PROFILES, start=1):
            self.users[uid] = User(id=uid, name=name, squad=squad, source="seed", is_demo=True)
            self.nights[uid] = _gen_nights(uid, bed_h, sleep_h, kind, today)
            self.scores[uid] = compute_scores(self.nights[uid])

    def list_users(self) -> list[User]:
        return list(self.users.values())

    def has_user(self, uid: int) -> bool:
        return uid in self.users

    def delete_user(self, uid: int) -> None:
        """Remove the user and all their rows."""
        for table in (self.users, self.nights, self.scores, self.hashes):
            table.pop(uid, None)

    def login_info(self, name: str) -> tuple[User, str | None] | None:
        """(user, password_hash) for a case-insensitive name, or None."""
        u = next((u for u in self.users.values() if u.name.lower() == name.strip().lower()), None)
        return (u, self.hashes.get(u.id)) if u else None

    def set_password(self, uid: int, hashed: str) -> None:
        self.hashes[uid] = hashed

    def recent_nights(self, uid: int, limit: int = 28) -> list[SleepNight]:
        """Last `limit` nights, oldest first (for the weekly AI insight)."""
        return self.nights.get(uid, [])[-limit:]

    def add_nights(self, uid: int, new: list[SleepNight]) -> None:
        """Merge by wake date (new replaces old), then rescore the user's history."""
        by_day = {n.day: n for n in self.nights[uid]}
        by_day.update({n.day: n for n in new})
        self.nights[uid] = sorted(by_day.values(), key=lambda n: n.day)
        self.scores[uid] = compute_scores(self.nights[uid])
        self.users[uid] = self.users[uid].model_copy(update={"is_demo": False, "source": "shortcut"})

    def overview(self, uid: int) -> Overview | None:
        user = self.users.get(uid)
        if user is None:
            return None
        nights, scores = self.nights[uid], self.scores[uid]
        if not nights:
            return Overview(user=user)
        streak = scores[-1].streak_days
        return Overview(
            user=user,
            last_night=nights[-1],
            score=scores[-1],
            history=[
                NightScore(
                    day=n.day, score=s.score, bedtime=n.bedtime, wake_time=n.wake_time, duration_min=n.duration_min
                )
                for n, s in zip(nights[-7:], scores[-7:])
            ],
            streak_days=streak,
            badge=badge_for(streak),
            best_streak=max(s.streak_days for s in scores),
        )

    def weekly_avgs(self, monday: date) -> dict[int, float]:
        """Average nightly score per user for the week starting `monday` (users with no nights that week are absent)."""
        end = monday + timedelta(days=7)
        out = {}
        for uid in self.users:
            vals = [s.score for n, s in zip(self.nights[uid], self.scores[uid]) if monday <= n.day < end]
            if vals:
                out[uid] = mean(vals)
        return out

    def leaderboard(self, period: str, squad: str | None, before: date = date.max) -> Leaderboard:
        """`before` drops nights on/after that wake date (rank as of an earlier day)."""
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date.min  # week resets Monday
        rows = []
        for uid, user in self.users.items():
            if squad and (user.squad or "").lower() != squad.lower():
                continue
            vals = [s.score for n, s in zip(self.nights[uid], self.scores[uid]) if since <= n.day < before]
            if vals:
                streak = self.scores[uid][-1].streak_days
                rows.append((round(mean(vals), 1), user, streak))
        rows.sort(key=lambda r: (-r[0], r[1].name))
        entries = [
            LeaderboardEntry(
                rank=i, user_id=u.id, name=u.name, squad=u.squad, score=sc, streak_days=st, badge=badge_for(st)
            )
            for i, (sc, u, st) in enumerate(rows, start=1)
        ]
        return Leaderboard(period=period, squad=squad, entries=entries)


def _naive(row: dict) -> dict:
    """Session is UTC and we store wall-clock times, so dropping tzinfo restores the device-local time."""
    return {k: v.replace(tzinfo=None) if isinstance(v, datetime) else v for k, v in row.items()}


NIGHT_COLS = (
    "time AS bedtime, end_time AS wake_time, duration_min, efficiency, deep_min, rem_min, light_min, awake_min, source"
)
SCORE_COLS = "score, duration_pts, consistency_pts, quality_pts, streak_pts, streak_days"


def _night(row: dict) -> SleepNight:
    row = _naive(row)
    return SleepNight(day=row["wake_time"].date(), **row)


class SqlStore:
    """Tiger Cloud backed store; same methods and response shapes as Store."""

    def list_users(self) -> list[User]:
        with get_pool().connection() as c:
            return [User(**r) for r in c.execute("SELECT id, name, squad, source, is_demo FROM users ORDER BY id")]

    def has_user(self, uid: int) -> bool:
        with get_pool().connection() as c:
            return c.execute("SELECT 1 FROM users WHERE id = %s", (uid,)).fetchone() is not None

    def delete_user(self, uid: int) -> None:
        """Children first (foreign keys), one transaction."""
        with get_pool().connection() as c:
            for table in ("daily_scores", "sleep_sessions"):
                c.execute(f"DELETE FROM {table} WHERE user_id = %s", (uid,))
            c.execute("DELETE FROM users WHERE id = %s", (uid,))

    def login_info(self, name: str) -> tuple[User, str | None] | None:
        with get_pool().connection() as c:
            r = c.execute(
                "SELECT id, name, squad, source, is_demo, password_hash FROM users WHERE lower(name) = lower(%s)",
                (name.strip(),),
            ).fetchone()
        return (User(**{k: r[k] for k in User.model_fields}), r["password_hash"]) if r else None

    def set_password(self, uid: int, hashed: str) -> None:
        with get_pool().connection() as c:
            c.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, uid))

    def recent_nights(self, uid: int, limit: int = 28) -> list[SleepNight]:
        """Last `limit` nights, oldest first (for the weekly AI insight)."""
        with get_pool().connection() as c:
            rows = c.execute(
                f"SELECT {NIGHT_COLS} FROM sleep_sessions WHERE user_id = %s ORDER BY end_time DESC LIMIT %s",
                (uid, limit),
            ).fetchall()
        return [_night(r) for r in rows[::-1]]

    def add_nights(self, uid: int, new: list[SleepNight]) -> None:
        """Replace by wake date, then rescore the user's whole history (one transaction)."""
        with get_pool().connection() as c:
            for n in new:
                c.execute("DELETE FROM sleep_sessions WHERE user_id = %s AND end_time::date = %s", (uid, n.day))
                c.execute(
                    "INSERT INTO sleep_sessions (time, user_id, end_time, duration_min, efficiency, deep_min,"
                    " rem_min, light_min, awake_min, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (n.bedtime, uid, n.wake_time, n.duration_min, n.efficiency, n.deep_min, n.rem_min,
                     n.light_min, n.awake_min, n.source),
                )
            nights = [_night(r) for r in c.execute(
                f"SELECT {NIGHT_COLS} FROM sleep_sessions WHERE user_id = %s ORDER BY end_time", (uid,))]
            c.execute("DELETE FROM daily_scores WHERE user_id = %s", (uid,))
            for n, s in zip(nights, compute_scores(nights)):
                c.execute(
                    "INSERT INTO daily_scores (time, user_id, score, duration_pts, consistency_pts, quality_pts,"
                    " streak_pts, streak_days) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                    (datetime.combine(n.day, time(8)), uid, s.score, s.duration_pts, s.consistency_pts,
                     s.quality_pts, s.streak_pts, s.streak_days),
                )
            c.execute("UPDATE users SET is_demo = false, source = 'shortcut' WHERE id = %s", (uid,))

    def overview(self, uid: int) -> Overview | None:
        with get_pool().connection() as c:
            u = c.execute("SELECT id, name, squad, source, is_demo FROM users WHERE id = %s", (uid,)).fetchone()
            if u is None:
                return None
            user = User(**u)
            last = c.execute(
                f"SELECT {NIGHT_COLS} FROM sleep_sessions WHERE user_id = %s ORDER BY end_time DESC LIMIT 1", (uid,)
            ).fetchone()
            if last is None:
                return Overview(user=user)
            recent = c.execute(
                f"SELECT d.time::date AS day, {SCORE_COLS},"
                " s.time AS bedtime, s.end_time AS wake_time, s.duration_min FROM daily_scores d"
                " LEFT JOIN sleep_sessions s ON s.user_id = d.user_id AND s.end_time::date = d.time::date"
                " WHERE d.user_id = %s ORDER BY d.time DESC LIMIT 7", (uid,)
            ).fetchall()[::-1]  # oldest first
            best = c.execute("SELECT max(streak_days) AS m FROM daily_scores WHERE user_id = %s", (uid,)).fetchone()["m"]
        score = ScoreBreakdown(**{k: recent[-1][k] for k in ScoreBreakdown.model_fields})
        return Overview(
            user=user,
            last_night=_night(last),
            score=score,
            history=[
                NightScore(**_naive({k: r[k] for k in ("day", "score", "bedtime", "wake_time", "duration_min")}))
                for r in recent
            ],
            streak_days=score.streak_days,
            badge=badge_for(score.streak_days),
            best_streak=best,
        )

    def weekly_avgs(self, monday: date) -> dict[int, float]:
        """Same as Store.weekly_avgs, read from the weekly_leaderboard continuous aggregate."""
        with get_pool().connection() as c:
            rows = c.execute("SELECT user_id, avg_score FROM weekly_leaderboard WHERE week = %s", (monday,))
            return {r["user_id"]: r["avg_score"] for r in rows}

    def leaderboard(self, period: str, squad: str | None, before: date = date(9999, 12, 31)) -> Leaderboard:
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date(1970, 1, 1)
        with get_pool().connection() as c:
            rows = c.execute(
                "SELECT u.id, u.name, u.squad, avg(d.score)::float AS score,"
                " (SELECT streak_days FROM daily_scores WHERE user_id = u.id ORDER BY time DESC LIMIT 1) AS streak"
                " FROM users u JOIN daily_scores d ON d.user_id = u.id"
                " WHERE d.time >= %s AND d.time::date < %s AND (%s::text IS NULL OR lower(u.squad) = lower(%s))"
                " GROUP BY u.id ORDER BY score DESC, u.name",
                (since, before, squad, squad),
            ).fetchall()
        entries = [
            LeaderboardEntry(
                rank=i, user_id=r["id"], name=r["name"], squad=r["squad"], score=round(r["score"], 1),
                streak_days=r["streak"], badge=badge_for(r["streak"]),
            )
            for i, r in enumerate(rows, start=1)
        ]
        return Leaderboard(period=period, squad=squad, entries=entries)


# No DATABASE_URL (fresh clone, CI) -> in-memory demo data.
store = SqlStore() if settings.database_url else Store()