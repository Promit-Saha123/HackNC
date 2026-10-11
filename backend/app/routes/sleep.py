import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from ..auth import current_user_id, ingest_user_id, require_self
from ..models import HistoryNight, Overview, ShortcutResult, SleepNight, User
from ..store import store

router = APIRouter()

# Shortcuts "Value" labels, normalised (lowercase, no spaces) -> stage
STAGES = {
    "core": "light", "asleepcore": "light", "asleep": "light",
    "deep": "deep", "asleepdeep": "deep",
    "rem": "rem", "asleeprem": "rem",
    "awake": "awake", "inbed": "inbed",
}
NIGHT_GAP = timedelta(hours=3)  # a bigger gap between samples starts a new night
MIN_ASLEEP_MIN = 30  # ignore naps / noise


def parse_samples(text: str) -> tuple[list[tuple[datetime, datetime, str]], int]:
    """Parse 'start_iso|end_iso|value' lines. Returns (samples, skipped_line_count).
    Timestamps keep device-local wall-clock time (tz offset dropped)."""
    samples, skipped = [], 0
    for line in text.splitlines():
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split("|")]
        try:
            if len(parts) != 3:
                raise ValueError
            start = datetime.fromisoformat(parts[0]).replace(tzinfo=None)
            end = datetime.fromisoformat(parts[1]).replace(tzinfo=None)
            stage = STAGES[re.sub(r"[\s_]", "", parts[2]).lower()]
            if end <= start:
                raise ValueError
        except (ValueError, KeyError):
            skipped += 1
            continue
        samples.append((start, end, stage))
    return samples, skipped


def samples_to_nights(samples) -> list[SleepNight]:
    """Merge stage samples into one night per wake date.
    ponytail: overlapping samples from several sources are summed, not de-duplicated; dedupe by source if it matters."""
    groups: list[list] = []
    for s in sorted(samples, key=lambda s: s[0]):
        if groups and s[0] - max(x[1] for x in groups[-1]) <= NIGHT_GAP:
            groups[-1].append(s)
        else:
            groups.append([s])
    best: dict = {}
    for g in groups:
        mins = {"light": 0, "deep": 0, "rem": 0, "awake": 0, "inbed": 0}
        for start, end, stage in g:
            mins[stage] += int((end - start).total_seconds() // 60)
        asleep = mins["light"] + mins["deep"] + mins["rem"]
        if asleep < MIN_ASLEEP_MIN:
            continue
        bed, wake = min(x[0] for x in g), max(x[1] for x in g)
        span = max(int((wake - bed).total_seconds() // 60), asleep)
        night = SleepNight(
            day=wake.date(), bedtime=bed, wake_time=wake, duration_min=asleep,
            efficiency=round(min(1.0, asleep / span), 3),
            deep_min=mins["deep"], rem_min=mins["rem"], light_min=mins["light"],
            awake_min=max(0, span - asleep), source="shortcut",
        )
        if night.day not in best or night.duration_min > best[night.day].duration_min:
            best[night.day] = night
    return sorted(best.values(), key=lambda n: n.day)


@router.get("/users", response_model=list[User])
def users(limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0)):
    """The demo profiles (the login picker), paged. Real accounts are never listed, so strangers can't enumerate them."""
    return store.list_users(limit, offset, demo_only=True)


@router.get("/users/{user_id}/overview", response_model=Overview, dependencies=[Depends(require_self)])
def overview(user_id: int):
    result = store.overview(user_id)
    if result is None:
        raise HTTPException(404, "unknown user")
    return result


@router.get("/users/{user_id}/history", response_model=list[HistoryNight], dependencies=[Depends(require_self)])
def history(user_id: int, days: int = Query(60, ge=1, le=365)):
    """The last `days` nights (oldest first) with times, stage minutes and score: powers the calendar and Trends."""
    nights = store.history(user_id, days)
    if nights is None:
        raise HTTPException(404, "unknown user")
    return nights


@router.delete("/users/{user_id}/data", status_code=204)
def delete_data(user_id: int, uid: int = Depends(current_user_id)):
    """Privacy: remove a user's rows (own account only). Demo profiles are shared by the whole squad, so they can't be deleted."""
    if uid != user_id:
        raise HTTPException(403, "you can only delete your own data")
    user = store.get_user(user_id)
    if user is None:
        raise HTTPException(404, "unknown user")
    if user.is_demo:
        raise HTTPException(403, "demo profiles can't be deleted")
    store.delete_user(user_id)


@router.post("/sleep/shortcut", response_model=ShortcutResult)
async def shortcut(request: Request, x_ingest_token: str = Header(""), x_user_id: int | None = Header(None)):
    """Plain-text body from the iOS Shortcut: one 'start_iso|end_iso|value' per line.
    Identify the user with a plain X-User-Id, or with an X-Ingest-Token (from POST /ingest/token), which wins if both are sent."""
    x_user_id = ingest_user_id(x_ingest_token) if x_ingest_token else x_user_id
    user = store.get_user(x_user_id) if x_user_id is not None else None
    if user is None:
        raise HTTPException(404 if x_user_id is not None else 401, "unknown user" if x_user_id is not None else "missing X-User-Id or X-Ingest-Token")
    samples, skipped = parse_samples((await request.body()).decode("utf-8", errors="replace"))
    nights = samples_to_nights(samples)
    if nights:
        store.add_nights(x_user_id, nights)
    return ShortcutResult(
        user_id=x_user_id, samples_parsed=len(samples), samples_skipped=skipped, nights_found=len(nights)
    )