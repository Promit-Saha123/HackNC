"""Two stores with the same methods: Store (in-memory, 8 seeded friends x 60 nights, used when DATABASE_URL
is unset and by scripts/seed.py) and SqlStore (Tiger Cloud). `store` at the bottom picks one."""
import random
import string
from datetime import date, datetime, time, timedelta
from statistics import mean

from .config import settings
from .db import get_pool
from psycopg import errors as pg_errors

from .models import (
    HistoryNight, Leaderboard, LeaderboardEntry, NightScore, Overview, Prefs, Profile, ProfileStats, ScoreBreakdown,
    SleepNight, SquadEntry, SquadInfo, SquadMember, SyncStatus, User,
)
from .scoring import badge_for, compute_scores

class NameTaken(Exception):
    """Another account already uses that name (names are unique, ignoring case)."""


SEED_DAYS = 60
DEMO_SQUAD_CODES = {"Wolfpack": "WOLF23", "Night Owls": "OWLS42", "Library Rats": "RATS17"}  # also in db/004_profile.sql


def _new_code(name: str) -> str:
    """4 letters from the squad name + 2 digits, e.g. 'Study Buddies' -> STUD42."""
    letters = "".join(ch for ch in name.upper() if ch in string.ascii_uppercase).ljust(4, "X")[:4]
    return letters + str(random.randint(10, 99))

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
        self.prefs: dict[int, Prefs] = {}
        self.synced: dict[int, datetime] = {}  # last Shortcut sync per user
        self.extra: dict[int, dict] = {}  # avatar / bio / created per user
        self.squads: dict[str, str] = dict(DEMO_SQUAD_CODES)  # name -> invite code
        for uid, (name, squad, bed_h, sleep_h, kind) in enumerate(PROFILES, start=1):
            self.users[uid] = User(id=uid, name=name, squad=squad, source="seed", is_demo=True)
            self.nights[uid] = _gen_nights(uid, bed_h, sleep_h, kind, today)
            self.scores[uid] = compute_scores(self.nights[uid])

    def list_users(self, limit: int = 200, offset: int = 0, demo_only: bool = False) -> list[User]:
        users = [u for u in self.users.values() if u.is_demo or not demo_only]
        return users[offset : offset + limit]

    def get_user(self, uid: int) -> User | None:
        return self.users.get(uid)

    def has_user(self, uid: int) -> bool:
        return uid in self.users

    def delete_user(self, uid: int) -> None:
        """Remove the user and all their rows."""
        for table in (self.users, self.nights, self.scores, self.hashes, self.prefs, self.synced, self.extra):
            table.pop(uid, None)

    def login_info(self, name: str) -> tuple[User, str | None] | None:
        """(user, password_hash) for a case-insensitive name, or None."""
        u = next((u for u in self.users.values() if u.name.lower() == name.strip().lower()), None)
        return (u, self.hashes.get(u.id)) if u else None

    def credentials(self, uid: int) -> tuple[str | None, bool] | None:
        """(password_hash, is_demo) for the password-change check, or None for an unknown user."""
        u = self.users.get(uid)
        return (self.hashes.get(uid), u.is_demo) if u else None

    def create_user(self, name: str, hashed: str) -> User | None:
        """A new real account. None if the name is taken."""
        if any(u.name.lower() == name.lower() for u in self.users.values()):
            return None
        uid = max(self.users, default=0) + 1
        self.users[uid] = User(id=uid, name=name, squad=None, source=None, is_demo=False)
        self.nights[uid], self.scores[uid], self.hashes[uid] = [], [], hashed
        self.extra[uid] = {"created": datetime.now()}
        return self.users[uid]

    def get_profile(self, uid: int) -> Profile | None:
        u = self.users.get(uid)
        if u is None:
            return None
        ex, scores = self.extra.get(uid, {}), self.scores.get(uid, [])
        last30 = [s.score for s in scores[-30:]]
        stats = ProfileStats(
            nights=len(self.nights.get(uid, [])), best_streak=max((s.streak_days for s in scores), default=0),
            avg_score=round(mean(last30), 1) if last30 else None,
        )
        return Profile(
            id=uid, name=u.name, avatar=ex.get("avatar"), bio=ex.get("bio"), squad=u.squad, is_demo=u.is_demo,
            member_since=ex.get("created"), stats=stats,
        )

    def update_profile(self, uid: int, name: str | None, avatar: str | None, bio: str | None) -> Profile:
        """None = leave as is, "" = clear (avatar/bio). Raises NameTaken on a duplicate name."""
        if name is not None:
            if any(u.id != uid and u.name.lower() == name.lower() for u in self.users.values()):
                raise NameTaken(name)
            self.users[uid] = self.users[uid].model_copy(update={"name": name})
        ex = self.extra.setdefault(uid, {})
        for key, value in (("avatar", avatar), ("bio", bio)):
            if value is not None:
                ex[key] = value or None
        return self.get_profile(uid)

    def set_password(self, uid: int, hashed: str) -> None:
        self.hashes[uid] = hashed

    def get_prefs(self, uid: int) -> Prefs:
        return self.prefs.get(uid, Prefs())

    def set_prefs(self, uid: int, p: Prefs) -> None:
        hours_changed = self.get_prefs(uid).hours != p.hours
        self.prefs[uid] = p
        if hours_changed and uid in self.nights:  # the hours goal feeds the duration score
            self.scores[uid] = compute_scores(self.nights[uid], p.hours)

    def get_squad(self, uid: int) -> SquadInfo | None:
        name = self.users[uid].squad
        return SquadInfo(name=name, code=self.squads[name]) if name in self.squads else None

    def create_squad(self, uid: int, name: str) -> SquadInfo | None:
        """None if the name is taken (case-insensitive)."""
        if name.lower() in (n.lower() for n in self.squads):
            return None
        code = _new_code(name)
        while code in self.squads.values():
            code = _new_code(name)
        self.squads[name] = code
        self.users[uid] = self.users[uid].model_copy(update={"squad": name})
        return SquadInfo(name=name, code=code)

    def join_squad(self, uid: int, code: str) -> SquadInfo | None:
        name = next((n for n, c in self.squads.items() if c == code.strip().upper()), None)
        if name is None:
            return None
        self.users[uid] = self.users[uid].model_copy(update={"squad": name})
        return SquadInfo(name=name, code=self.squads[name])

    def leave_squad(self, uid: int) -> None:
        self.users[uid] = self.users[uid].model_copy(update={"squad": None})

    def squad_by_code(self, code: str) -> SquadInfo | None:
        name = next((n for n, c in self.squads.items() if c == code.strip().upper()), None)
        return SquadInfo(name=name, code=self.squads[name]) if name else None

    def recent_nights(self, uid: int, limit: int = 28) -> list[SleepNight]:
        """Last `limit` nights, oldest first (for the weekly AI insight)."""
        return self.nights.get(uid, [])[-limit:]

    def history(self, uid: int, days: int) -> list[HistoryNight] | None:
        """Last `days` nights with their scores, oldest first. None for an unknown user."""
        if uid not in self.users:
            return None
        return [
            HistoryNight(**n.model_dump(), score=s.score)
            for n, s in zip(self.nights[uid][-days:], self.scores[uid][-days:])
        ]

    def sync_status(self, uid: int) -> SyncStatus:
        at = self.synced.get(uid)
        synced = sum(n.source == "shortcut" for n in self.nights.get(uid, []))
        return SyncStatus(connected=at is not None, last_sync_at=at, nights_synced=synced)

    def add_nights(self, uid: int, new: list[SleepNight]) -> None:
        """Merge by wake date (new replaces old), then rescore the user's history."""
        by_day = {n.day: n for n in self.nights[uid]}
        by_day.update({n.day: n for n in new})
        self.nights[uid] = sorted(by_day.values(), key=lambda n: n.day)
        self.scores[uid] = compute_scores(self.nights[uid], self.get_prefs(uid).hours)
        if any(n.source == "shortcut" for n in new):
            self.users[uid] = self.users[uid].model_copy(update={"is_demo": False, "source": "shortcut"})
            self.synced[uid] = datetime.now()

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

    def leaderboard(self, period: str, squad: str | None, before: date = date.max, limit: int = 100) -> Leaderboard:
        """`before` drops nights on/after that wake date (rank as of an earlier day). Top `limit` entries only."""
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date.min  # week resets Monday
        rows = []
        for uid, user in self.users.items():
            if (squad and (user.squad or "").lower() != squad.lower()) or not self.prefs.get(uid, Prefs()).show_on_board:
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
            for i, (sc, u, st) in enumerate(rows[:limit], start=1)
        ]
        return Leaderboard(period=period, squad=squad, entries=entries)

    def _streak(self, uid: int) -> int:
        return self.scores[uid][-1].streak_days if self.scores.get(uid) else 0

    def improved(self, monday: date, squad: str | None, limit: int = 100) -> list[LeaderboardEntry]:
        """Most improved: this week's average minus last week's. Only improvers, biggest gain first."""
        now, before = self.weekly_avgs(monday), self.weekly_avgs(monday - timedelta(days=7))
        rows = []
        for uid, s in now.items():
            u = self.users[uid]
            if uid not in before or round(s - before[uid], 1) <= 0 or not self.prefs.get(uid, Prefs()).show_on_board:
                continue  # a gain that rounds to 0.0 isn't an improvement worth listing
            if squad and (u.squad or "").lower() != squad.lower():
                continue
            rows.append((s - before[uid], s, u))
        rows.sort(key=lambda r: (-r[0], r[2].name))
        return [
            LeaderboardEntry(
                rank=i, user_id=u.id, name=u.name, squad=u.squad, score=round(s, 1), streak_days=self._streak(u.id),
                badge=badge_for(self._streak(u.id)), delta=round(d, 1),
            )
            for i, (d, s, u) in enumerate(rows[:limit], start=1)
        ]

    def squad_board(self, period: str, limit: int = 50) -> list[SquadEntry]:
        """Squad vs squad: average member score, best first."""
        groups: dict[str, list[float]] = {}
        for e in self.leaderboard(period, None, limit=10**9).entries:
            if e.squad:
                groups.setdefault(e.squad, []).append(e.score)
        rows = sorted(((n, mean(v), len(v)) for n, v in groups.items()), key=lambda r: (-r[1], r[0]))
        return [SquadEntry(rank=i, squad=n, score=round(s, 1), members=m) for i, (n, s, m) in enumerate(rows[:limit], start=1)]

    def squad_members(self, name: str, limit: int = 100) -> list[SquadMember]:
        """Members who show on the leaderboard (score-level info only)."""
        out = []
        for u in self.users.values():
            if (u.squad or "").lower() == name.lower() and self.prefs.get(u.id, Prefs()).show_on_board:
                st = self._streak(u.id)
                out.append(SquadMember(user_id=u.id, name=u.name, streak_days=st, badge=badge_for(st)))
        return out[:limit]


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

    def list_users(self, limit: int = 200, offset: int = 0, demo_only: bool = False) -> list[User]:
        with get_pool().connection() as c:
            rows = c.execute(
                "SELECT id, name, squad, source, is_demo FROM users WHERE (NOT %s OR is_demo)"
                " ORDER BY id LIMIT %s OFFSET %s", (demo_only, limit, offset),
            )
            return [User(**r) for r in rows]

    def get_user(self, uid: int) -> User | None:
        with get_pool().connection() as c:
            r = c.execute("SELECT id, name, squad, source, is_demo FROM users WHERE id = %s", (uid,)).fetchone()
        return User(**r) if r else None

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

    def credentials(self, uid: int) -> tuple[str | None, bool] | None:
        """(password_hash, is_demo) for the password-change check, or None for an unknown user."""
        with get_pool().connection() as c:
            r = c.execute("SELECT password_hash, is_demo FROM users WHERE id = %s", (uid,)).fetchone()
        return (r["password_hash"], r["is_demo"]) if r else None

    def create_user(self, name: str, hashed: str) -> User | None:
        """A new real account. None if the name is taken (the unique index on lower(name) decides, so two
        simultaneous signups can't both win)."""
        try:
            with get_pool().connection() as c:
                r = c.execute(
                    "INSERT INTO users (name, source, is_demo, password_hash) VALUES (%s, NULL, false, %s)"
                    " RETURNING id, name, squad, source, is_demo", (name, hashed),
                ).fetchone()
        except pg_errors.UniqueViolation:
            return None
        return User(**r)

    def get_profile(self, uid: int) -> Profile | None:
        with get_pool().connection() as c:
            r = c.execute(
                "SELECT u.id, u.name, u.avatar, u.bio, u.squad, u.is_demo, u.created_at AS member_since,"
                " (SELECT count(*) FROM sleep_sessions WHERE user_id = u.id) AS nights,"
                " (SELECT coalesce(max(streak_days), 0) FROM daily_scores WHERE user_id = u.id) AS best_streak,"
                " (SELECT avg(score)::float FROM (SELECT score FROM daily_scores WHERE user_id = u.id"
                "  ORDER BY time DESC LIMIT 30) x) AS avg_score FROM users u WHERE u.id = %s", (uid,),
            ).fetchone()
        if r is None:
            return None
        r = _naive(r)
        stats = ProfileStats(
            nights=r["nights"], best_streak=r["best_streak"],
            avg_score=round(r["avg_score"], 1) if r["avg_score"] is not None else None,
        )
        return Profile(
            id=r["id"], name=r["name"], avatar=r["avatar"], bio=r["bio"], squad=r["squad"], is_demo=r["is_demo"],
            member_since=r["member_since"], stats=stats,
        )

    def update_profile(self, uid: int, name: str | None, avatar: str | None, bio: str | None) -> Profile:
        """None = leave as is, "" = clear (avatar/bio). Raises NameTaken on a duplicate name."""
        sets, params = [], []
        for col, value in (("name", name), ("avatar", avatar), ("bio", bio)):
            if value is not None:
                sets.append(f"{col} = %s")
                params.append(value if col == "name" else (value or None))
        if sets:
            try:
                with get_pool().connection() as c:
                    c.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", (*params, uid))
            except pg_errors.UniqueViolation:
                raise NameTaken(name) from None
        return self.get_profile(uid)

    def get_prefs(self, uid: int) -> Prefs:
        with get_pool().connection() as c:
            r = c.execute(
                "SELECT goal_bedtime AS bedtime, goal_wake AS wake, goal_hours AS hours, share_details, show_on_board"
                " FROM users WHERE id = %s", (uid,)
            ).fetchone()
        return Prefs(**r)

    def set_prefs(self, uid: int, p: Prefs) -> None:
        with get_pool().connection() as c:
            old = c.execute("SELECT goal_hours FROM users WHERE id = %s", (uid,)).fetchone()
            c.execute(
                "UPDATE users SET goal_bedtime = %s, goal_wake = %s, goal_hours = %s, share_details = %s,"
                " show_on_board = %s WHERE id = %s",
                (p.bedtime, p.wake, p.hours, p.share_details, p.show_on_board, uid),
            )
            if old and old["goal_hours"] != p.hours:  # the hours goal feeds the duration score
                self._rescore(c, uid)

    def get_squad(self, uid: int) -> SquadInfo | None:
        with get_pool().connection() as c:
            r = c.execute(
                "SELECT s.name, s.code FROM users u JOIN squads s ON s.name = u.squad WHERE u.id = %s", (uid,)
            ).fetchone()
        return SquadInfo(**r) if r else None

    def create_squad(self, uid: int, name: str) -> SquadInfo | None:
        """None if the name is taken (case-insensitive)."""
        with get_pool().connection() as c:
            if c.execute("SELECT 1 FROM squads WHERE lower(name) = lower(%s)", (name,)).fetchone():
                return None
            code = _new_code(name)
            while c.execute("SELECT 1 FROM squads WHERE code = %s", (code,)).fetchone():
                code = _new_code(name)
            c.execute("INSERT INTO squads (name, code) VALUES (%s, %s)", (name, code))
            c.execute("UPDATE users SET squad = %s WHERE id = %s", (name, uid))
        return SquadInfo(name=name, code=code)

    def join_squad(self, uid: int, code: str) -> SquadInfo | None:
        with get_pool().connection() as c:
            r = c.execute("SELECT name, code FROM squads WHERE code = %s", (code.strip().upper(),)).fetchone()
            if r:
                c.execute("UPDATE users SET squad = %s WHERE id = %s", (r["name"], uid))
        return SquadInfo(**r) if r else None

    def leave_squad(self, uid: int) -> None:
        with get_pool().connection() as c:
            c.execute("UPDATE users SET squad = NULL WHERE id = %s", (uid,))

    def squad_by_code(self, code: str) -> SquadInfo | None:
        with get_pool().connection() as c:
            r = c.execute("SELECT name, code FROM squads WHERE code = %s", (code.strip().upper(),)).fetchone()
        return SquadInfo(**r) if r else None

    def recent_nights(self, uid: int, limit: int = 28) -> list[SleepNight]:
        """Last `limit` nights, oldest first (for the weekly AI insight)."""
        with get_pool().connection() as c:
            rows = c.execute(
                f"SELECT {NIGHT_COLS} FROM sleep_sessions WHERE user_id = %s ORDER BY end_time DESC LIMIT %s",
                (uid, limit),
            ).fetchall()
        return [_night(r) for r in rows[::-1]]

    def history(self, uid: int, days: int) -> list[HistoryNight] | None:
        """Last `days` nights with their scores, oldest first. None for an unknown user."""
        if not self.has_user(uid):
            return None
        with get_pool().connection() as c:
            rows = c.execute(
                "SELECT s.time AS bedtime, s.end_time AS wake_time, s.duration_min, s.efficiency, s.deep_min,"
                " s.rem_min, s.light_min, s.awake_min, s.source, d.score FROM sleep_sessions s"
                " JOIN daily_scores d ON d.user_id = s.user_id AND d.time::date = s.end_time::date"
                " WHERE s.user_id = %s ORDER BY s.end_time DESC LIMIT %s",
                (uid, days),
            ).fetchall()
        return [HistoryNight(**_night(r).model_dump(), score=r["score"]) for r in rows[::-1]]

    def sync_status(self, uid: int) -> SyncStatus:
        with get_pool().connection() as c:
            r = c.execute(
                "SELECT last_sync_at, (SELECT count(*) FROM sleep_sessions WHERE user_id = %s AND source = 'shortcut')"
                " AS n FROM users WHERE id = %s",
                (uid, uid),
            ).fetchone()
        if r is None:
            return SyncStatus(connected=False)
        r = _naive(r)
        return SyncStatus(connected=r["last_sync_at"] is not None, last_sync_at=r["last_sync_at"], nights_synced=r["n"])

    def _rescore(self, c, uid: int) -> None:
        """Rebuild the user's daily_scores from their nights and their hours goal (call inside a transaction)."""
        hours = c.execute("SELECT goal_hours FROM users WHERE id = %s", (uid,)).fetchone()["goal_hours"]
        nights = [_night(r) for r in c.execute(
            f"SELECT {NIGHT_COLS} FROM sleep_sessions WHERE user_id = %s ORDER BY end_time", (uid,))]
        c.execute("DELETE FROM daily_scores WHERE user_id = %s", (uid,))
        rows = [
            (datetime.combine(n.day, time(8)), uid, s.score, s.duration_pts, s.consistency_pts, s.quality_pts,
             s.streak_pts, s.streak_days)
            for n, s in zip(nights, compute_scores(nights, hours))
        ]
        # one batched round trip, not one INSERT per night
        c.cursor().executemany(
            "INSERT INTO daily_scores (time, user_id, score, duration_pts, consistency_pts, quality_pts,"
            " streak_pts, streak_days) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", rows,
        )

    def add_nights(self, uid: int, new: list[SleepNight]) -> None:
        """Replace by wake date, then rescore the user's whole history (one transaction)."""
        with get_pool().connection() as c:
            cur = c.cursor()
            for n in new:  # a range, not end_time::date = day, so the (user_id, end_time) index is used
                start = datetime.combine(n.day, time())
                c.execute(
                    "DELETE FROM sleep_sessions WHERE user_id = %s AND end_time >= %s AND end_time < %s",
                    (uid, start, start + timedelta(days=1)),
                )
            cur.executemany(
                "INSERT INTO sleep_sessions (time, user_id, end_time, duration_min, efficiency, deep_min,"
                " rem_min, light_min, awake_min, source) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                [(n.bedtime, uid, n.wake_time, n.duration_min, n.efficiency, n.deep_min, n.rem_min, n.light_min,
                  n.awake_min, n.source) for n in new],
            )
            self._rescore(c, uid)
            if any(n.source == "shortcut" for n in new):
                c.execute(
                    "UPDATE users SET is_demo = false, source = 'shortcut', last_sync_at = %s WHERE id = %s",
                    (datetime.now(), uid),
                )

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

    # Latest streak per user, looked up only for the rows a query actually returns (uses daily_scores_user_time).
    _STREAK = " LEFT JOIN LATERAL (SELECT streak_days FROM daily_scores WHERE user_id = t.id ORDER BY time DESC LIMIT 1) st ON true"

    def leaderboard(
        self, period: str, squad: str | None, before: date = date(9999, 12, 31), limit: int = 100
    ) -> Leaderboard:
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date(1970, 1, 1)
        with get_pool().connection() as c:
            rows = c.execute(
                "WITH t AS (SELECT u.id, u.name, u.squad, avg(d.score)::float AS score"
                " FROM users u JOIN daily_scores d ON d.user_id = u.id"
                " WHERE u.show_on_board AND d.time >= %s AND d.time < %s AND (%s::text IS NULL OR lower(u.squad) = lower(%s))"
                " GROUP BY u.id ORDER BY score DESC, u.name LIMIT %s)"
                " SELECT t.*, st.streak_days AS streak FROM t" + self._STREAK + " ORDER BY t.score DESC, t.name",
                (since, before, squad, squad, limit),
            ).fetchall()
        entries = [
            LeaderboardEntry(
                rank=i, user_id=r["id"], name=r["name"], squad=r["squad"], score=round(r["score"], 1),
                streak_days=r["streak"] or 0, badge=badge_for(r["streak"] or 0),
            )
            for i, r in enumerate(rows, start=1)
        ]
        return Leaderboard(period=period, squad=squad, entries=entries)

    def improved(self, monday: date, squad: str | None, limit: int = 100) -> list[LeaderboardEntry]:
        """Most improved, straight from the weekly_leaderboard aggregate (one row per user per week)."""
        with get_pool().connection() as c:
            rows = c.execute(
                "WITH t AS (SELECT u.id, u.name, u.squad, w1.avg_score::float AS score,"
                " (w1.avg_score - w0.avg_score)::float AS delta FROM weekly_leaderboard w1"
                " JOIN weekly_leaderboard w0 ON w0.user_id = w1.user_id AND w0.week = %s"
                " JOIN users u ON u.id = w1.user_id"
                " WHERE w1.week = %s AND u.show_on_board AND round((w1.avg_score - w0.avg_score)::numeric, 1) > 0"
                " AND (%s::text IS NULL OR lower(u.squad) = lower(%s))"
                " ORDER BY delta DESC, u.name LIMIT %s)"
                " SELECT t.*, st.streak_days AS streak FROM t" + self._STREAK + " ORDER BY t.delta DESC, t.name",
                (monday - timedelta(days=7), monday, squad, squad, limit),
            ).fetchall()
        return [
            LeaderboardEntry(
                rank=i, user_id=r["id"], name=r["name"], squad=r["squad"], score=round(r["score"], 1),
                streak_days=r["streak"] or 0, badge=badge_for(r["streak"] or 0), delta=round(r["delta"], 1),
            )
            for i, r in enumerate(rows, start=1)
        ]

    def squad_board(self, period: str, limit: int = 50) -> list[SquadEntry]:
        """Squad vs squad: average of members' average scores, computed in SQL."""
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date(1970, 1, 1)
        with get_pool().connection() as c:
            rows = c.execute(
                "WITH per_user AS (SELECT u.squad, round(avg(d.score)::numeric, 1) AS s FROM users u"
                " JOIN daily_scores d ON d.user_id = u.id"
                " WHERE u.show_on_board AND u.squad IS NOT NULL AND d.time >= %s GROUP BY u.id, u.squad)"
                " SELECT squad, avg(s)::float AS score, count(*) AS members FROM per_user"
                " GROUP BY squad ORDER BY score DESC, squad LIMIT %s",
                (since, limit),
            ).fetchall()
        return [
            SquadEntry(rank=i, squad=r["squad"], score=round(r["score"], 1), members=r["members"])
            for i, r in enumerate(rows, start=1)
        ]

    def squad_members(self, name: str, limit: int = 100) -> list[SquadMember]:
        """Members who show on the leaderboard (score-level info only)."""
        with get_pool().connection() as c:
            rows = c.execute(
                "WITH t AS (SELECT id, name FROM users WHERE lower(squad) = lower(%s) AND show_on_board"
                " ORDER BY id LIMIT %s)"
                " SELECT t.*, st.streak_days AS streak FROM t" + self._STREAK + " ORDER BY t.id",
                (name, limit),
            ).fetchall()
        return [
            SquadMember(user_id=r["id"], name=r["name"], streak_days=r["streak"] or 0, badge=badge_for(r["streak"] or 0))
            for r in rows
        ]


# No DATABASE_URL (fresh clone, CI) -> in-memory demo data.
store = SqlStore() if settings.database_url else Store()