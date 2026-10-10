"""Pydantic models = the API contract (-> shared/openapi.json -> app/src/api/schema.ts).
Contracts are additive only: add fields, never rename or remove mid-slice.

Datetimes are naive device-local wall-clock times (the Shortcut sends local time)."""
import datetime as dt
from typing import Literal

from pydantic import BaseModel


class User(BaseModel):
    id: int
    name: str
    squad: str | None = None
    source: str | None = None
    is_demo: bool = True


class SleepNight(BaseModel):
    day: dt.date  # wake-up date
    bedtime: dt.datetime
    wake_time: dt.datetime
    duration_min: int  # minutes asleep
    efficiency: float  # asleep / in bed, 0-1
    deep_min: int
    rem_min: int
    light_min: int
    awake_min: int
    source: str


class ScoreBreakdown(BaseModel):
    score: float  # 0-100
    duration_pts: float  # max 40
    consistency_pts: float  # max 30
    quality_pts: float  # max 20
    streak_pts: float  # max 10
    streak_days: int


class NightScore(BaseModel):
    day: dt.date
    score: float


class Overview(BaseModel):
    user: User
    last_night: SleepNight | None = None
    score: ScoreBreakdown | None = None
    history: list[NightScore] = []  # last 7 nights, oldest first
    streak_days: int = 0
    badge: str | None = None  # moon | cloud | rainbow | aurora


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    squad: str | None = None
    score: float
    streak_days: int
    badge: str | None = None


class Leaderboard(BaseModel):
    period: Literal["week", "all"]
    squad: str | None = None
    entries: list[LeaderboardEntry]


class ShortcutResult(BaseModel):
    user_id: int
    samples_parsed: int
    samples_skipped: int
    nights_found: int


class Briefing(BaseModel):
    user_id: int
    text: str
    audio_url: str | None = None