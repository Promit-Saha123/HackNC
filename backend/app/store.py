"""In-memory demo store (v1): 8 seeded friends x 60 nights, scored on load.
Mirrors what the Tiger Cloud queries will return; swap these methods for SQL once DATABASE_URL is wired."""
import random
from datetime import date, datetime, time, timedelta
from statistics import mean

from .models import Leaderboard, LeaderboardEntry, NightScore, Overview, SleepNight, User
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
        for uid, (name, squad, bed_h, sleep_h, kind) in enumerate(PROFILES, start=1):
            self.users[uid] = User(id=uid, name=name, squad=squad, source="seed", is_demo=True)
            self.nights[uid] = _gen_nights(uid, bed_h, sleep_h, kind, today)
            self.scores[uid] = compute_scores(self.nights[uid])

    def list_users(self) -> list[User]:
        return list(self.users.values())

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
            history=[NightScore(day=n.day, score=s.score) for n, s in zip(nights[-7:], scores[-7:])],
            streak_days=streak,
            badge=badge_for(streak),
        )

    def leaderboard(self, period: str, squad: str | None) -> Leaderboard:
        today = date.today()
        since = today - timedelta(days=today.weekday()) if period == "week" else date.min  # week resets Monday
        rows = []
        for uid, user in self.users.items():
            if squad and (user.squad or "").lower() != squad.lower():
                continue
            vals = [s.score for n, s in zip(self.nights[uid], self.scores[uid]) if n.day >= since]
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


store = Store()