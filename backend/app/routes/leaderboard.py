from typing import Literal

from fastapi import APIRouter

from ..models import Leaderboard
from ..store import store

router = APIRouter()


@router.get("/leaderboard", response_model=Leaderboard)
def leaderboard(period: Literal["week", "all"] = "week", squad: str | None = None):
    return store.leaderboard(period, squad)