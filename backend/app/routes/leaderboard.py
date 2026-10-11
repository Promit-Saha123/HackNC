from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import current_user_id
from ..models import FriendCard, FriendDetails, Leaderboard, SquadDetail, SquadLeaderboard
from ..scoring import bedtime_minutes
from ..store import store

router = APIRouter()


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard(
    period: Literal["week", "all", "improved"] = "week",
    squad: str | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    """Top `limit` entries. Ranking and the streak lookups happen in the database, so cost follows `limit`, not user count."""
    if period != "improved":
        lb = store.leaderboard(period, squad, limit=limit)
        prev = {e.user_id: e.rank for e in store.leaderboard(period, squad, before=date.today(), limit=limit).entries}
        for e in lb.entries:
            e.prev_rank = prev.get(e.user_id)
        return lb
    # Most improved: this week's average minus last week's. Only improvers are listed, there is no "worst" board.
    monday = date.today() - timedelta(days=date.today().weekday())
    return Leaderboard(period="improved", squad=squad, entries=store.improved(monday, squad, limit))


@router.get("/leaderboard/squads", response_model=SquadLeaderboard)
def squads(period: Literal["week", "all"] = "week", limit: int = Query(50, ge=1, le=200)):
    """Squad vs squad: average member score."""
    return SquadLeaderboard(period=period, entries=store.squad_board(period, limit))


@router.get("/squads/{code}", response_model=SquadDetail)
def squad_detail(code: str):
    """Who is in a squad (by invite code). Score-level info only, and members who hid from the leaderboard are left out."""
    squad = store.squad_by_code(code)
    if squad is None:
        raise HTTPException(404, "no squad with that code")
    return SquadDetail(name=squad.name, code=squad.code, members=store.squad_members(squad.name))


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
    profile = store.get_profile(user_id)
    return FriendCard(
        user_id=user_id, name=ov.user.name, squad=ov.user.squad, score=ov.score.score if ov.score else None,
        streak_days=ov.streak_days, best_streak=ov.best_streak, badge=ov.badge, details=details,
        avatar=profile.avatar if profile else None, bio=profile.bio if profile else None,
    )
