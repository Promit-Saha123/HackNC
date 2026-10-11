from datetime import date, timedelta
from statistics import mean
from typing import Literal

from fastapi import APIRouter

from ..models import Leaderboard, SquadEntry, SquadLeaderboard
from ..store import store

router = APIRouter()


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard(period: Literal["week", "all", "improved"] = "week", squad: str | None = None):
    if period != "improved":
        return store.leaderboard(period, squad)
    # Most improved: this week's average minus last week's. Only improvers are listed, there is no "worst" board.
    monday = date.today() - timedelta(days=date.today().weekday())
    now, before = store.weekly_avgs(monday), store.weekly_avgs(monday - timedelta(days=7))
    base = store.leaderboard("all", squad).entries
    rows = [(e, now[e.user_id], now[e.user_id] - before[e.user_id]) for e in base if e.user_id in now and e.user_id in before]
    rows = sorted((r for r in rows if r[2] > 0), key=lambda r: (-r[2], r[0].name))
    entries = [
        e.model_copy(update={"rank": i, "score": round(s, 1), "delta": round(d, 1)})
        for i, (e, s, d) in enumerate(rows, start=1)
    ]
    return Leaderboard(period="improved", squad=squad, entries=entries)


@router.get("/leaderboard/squads", response_model=SquadLeaderboard)
def squads(period: Literal["week", "all"] = "week"):
    """Squad vs squad: average member score."""
    groups: dict[str, list[float]] = {}
    for e in store.leaderboard(period, None).entries:
        if e.squad:
            groups.setdefault(e.squad, []).append(e.score)
    rows = sorted(((name, mean(v), len(v)) for name, v in groups.items()), key=lambda r: (-r[1], r[0]))
    return SquadLeaderboard(
        period=period,
        entries=[SquadEntry(rank=i, squad=n, score=round(s, 1), members=m) for i, (n, s, m) in enumerate(rows, start=1)],
    )
