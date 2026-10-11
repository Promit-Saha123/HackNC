from datetime import date, timedelta
from statistics import mean
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user_id
from ..models import FriendCard, FriendDetails, Leaderboard, SquadEntry, SquadLeaderboard
from ..scoring import bedtime_minutes
from ..store import store

router = APIRouter()


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard(period: Literal["week", "all", "improved"] = "week", squad: str | None = None):
    if period != "improved":
        lb = store.leaderboard(period, squad)
        prev = {e.user_id: e.rank for e in store.leaderboard(period, squad, before=date.today()).entries}
        for e in lb.entries:
            e.prev_rank = prev.get(e.user_id)
        return lb
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


@router.get("/users/{user_id}/card", response_model=FriendCard)
def friend_card(user_id: int, me: int = Depends(current_user_id)):
    """Friend card. Score and streak are always shown; bedtime and hours only if the user turned on sharing.
    Users who hid themselves from the leaderboard are visible only to themselves."""
    ov = store.overview(user_id)
    prefs = store.get_prefs(user_id) if ov else None
    if ov is None or (not prefs.show_on_board and me != user_id):
        raise HTTPException(404, "unknown user")
    details = None
    nights = store.recent_nights(user_id, 7) if prefs.share_details else []
    if nights:
        mid = sum(bedtime_minutes(n.bedtime) for n in nights) / len(nights)  # minutes since 18:00, no midnight wrap
        details = FriendDetails(
            avg_bedtime=round((mid + 18 * 60) % 1440), avg_hours=round(sum(n.duration_min for n in nights) / len(nights) / 60, 1)
        )
    return FriendCard(
        user_id=user_id, name=ov.user.name, squad=ov.user.squad, score=ov.score.score if ov.score else None,
        streak_days=ov.streak_days, best_streak=ov.best_streak, badge=ov.badge, details=details,
    )
