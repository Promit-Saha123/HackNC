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


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    user: User
    token: str


class SignupRequest(BaseModel):
    username: str  # 3-24 chars: letters, digits, _ . -  (unique, case-insensitive)
    password: str  # 8-128 chars


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileStats(BaseModel):
    nights: int = 0  # nights logged
    best_streak: int = 0
    avg_score: float | None = None  # last 30 nights


class Profile(BaseModel):
    """The signed-in user's own profile (GET/PUT /me)."""
    id: int
    name: str
    avatar: str | None = None  # a short emoji or key the app maps to a picture
    bio: str | None = None
    squad: str | None = None
    is_demo: bool = True
    member_since: dt.datetime | None = None
    stats: ProfileStats = ProfileStats()


class ProfileUpdate(BaseModel):
    """Send only what changes. Empty string clears avatar or bio."""
    name: str | None = None
    avatar: str | None = None
    bio: str | None = None


class Prefs(BaseModel):
    """Per-user goals and privacy toggles. Times are minutes after midnight."""
    bedtime: int = 22 * 60 + 45
    wake: int = 7 * 60
    hours: float = 8
    share_details: bool = True  # bedtime + hours on the friend card (score + streak are always visible)
    show_on_board: bool = True  # False hides the user from every leaderboard


class ManualNight(BaseModel):
    """A night typed in by hand. Send device-local wall-clock ISO times WITHOUT a UTC offset."""
    bed: dt.datetime
    wake: dt.datetime


class SquadInfo(BaseModel):
    name: str
    code: str  # invite code


class SquadCreate(BaseModel):
    name: str


class SquadJoin(BaseModel):
    code: str


class FriendDetails(BaseModel):
    avg_bedtime: int  # minutes after midnight (local), last 7 nights
    avg_hours: float


class FriendCard(BaseModel):
    """What a friend sees: score + streak always; details only if the user opted in (Prefs.share_details)."""
    user_id: int
    name: str
    squad: str | None = None
    score: float | None = None  # last night
    streak_days: int = 0
    best_streak: int = 0
    badge: str | None = None
    details: FriendDetails | None = None
    avatar: str | None = None
    bio: str | None = None


class IngestToken(BaseModel):
    user_id: int
    token: str


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
    bedtime: dt.datetime | None = None
    wake_time: dt.datetime | None = None
    duration_min: int | None = None  # minutes asleep


class HistoryNight(SleepNight):
    """One night in GET /users/{id}/history: the full night plus its score."""
    score: float


class Overview(BaseModel):
    user: User
    last_night: SleepNight | None = None
    score: ScoreBreakdown | None = None
    history: list[NightScore] = []  # last 7 nights, oldest first
    streak_days: int = 0
    badge: str | None = None  # moon | cloud | rainbow | aurora
    best_streak: int = 0


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    squad: str | None = None
    score: float
    streak_days: int
    badge: str | None = None
    prev_rank: int | None = None  # rank before last night (week/all); None = not ranked then
    delta: float | None = None  # period=improved only: this week's average minus last week's


class Leaderboard(BaseModel):
    period: Literal["week", "all", "improved"]
    squad: str | None = None
    entries: list[LeaderboardEntry]


class SquadEntry(BaseModel):
    rank: int
    squad: str
    score: float  # average member score
    members: int


class SquadLeaderboard(BaseModel):
    period: Literal["week", "all"]
    entries: list[SquadEntry]


class SquadMember(BaseModel):
    """Score-level info only: members who hid themselves from the leaderboard are left out."""
    user_id: int
    name: str
    streak_days: int = 0
    badge: str | None = None


class SquadDetail(BaseModel):
    name: str
    code: str
    members: list[SquadMember]


class SyncStatus(BaseModel):
    """Apple Health sync state for the Profile screen (the iOS Shortcut is the only sync path)."""
    connected: bool  # the Shortcut has synced at least once
    last_sync_at: dt.datetime | None = None
    nights_synced: int = 0


class WhoopStatus(BaseModel):
    """WHOOP connection for the Profile screen. Only sleep is ever read (scopes: read:sleep, read:profile, offline)."""
    configured: bool = True  # False when the server has no WHOOP app credentials yet
    connected: bool = False
    last_sync_at: dt.datetime | None = None
    nights_synced: int = 0


class WhoopConnectUrl(BaseModel):
    url: str  # open this in a browser: WHOOP login -> consent -> back to our callback


class WhoopSyncResult(BaseModel):
    nights_found: int


class ShortcutResult(BaseModel):
    user_id: int
    samples_parsed: int
    samples_skipped: int
    nights_found: int


class Briefing(BaseModel):
    user_id: int
    text: str
    audio_url: str | None = None


class Insight(BaseModel):
    """Weekly AI insight: one pattern from the user's own recent nights (P2, /ai/insight)."""
    user_id: int
    text: str
    kind: str | None = None  # bedtime | weekend | trend | steady; None = not enough nights yet
    nights_used: int = 0


class ChatMessage(BaseModel):
    """One turn in a Somni chat (P2, POST /ai/chat/{user_id})."""
    role: Literal["user", "somni"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]  # oldest first; the last one is the user's new question


class ChatReply(BaseModel):
    reply: str
    suggestions: list[str] = []  # 0-3 tappable follow-up questions
    in_scope: bool = True  # False when Somni declined an off-topic or medical question
