"""The signed-in user's own data: goals/privacy, manual sleep log, squad. The user always comes from the bearer token."""
from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user_id
from ..models import ManualNight, Prefs, SleepNight, SquadCreate, SquadInfo, SquadJoin
from ..store import store

router = APIRouter(prefix="/me")

MANUAL_EFFICIENCY = 0.9  # no stage data for a hand-typed night, so assume a typical efficiency


@router.get("/prefs", response_model=Prefs)
def get_prefs(uid: int = Depends(current_user_id)):
    return store.get_prefs(uid)


@router.put("/prefs", response_model=Prefs)
def put_prefs(p: Prefs, uid: int = Depends(current_user_id)):
    if not (0 <= p.bedtime < 1440 and 0 <= p.wake < 1440 and 4 <= p.hours <= 12):
        raise HTTPException(422, "goal out of range")
    store.set_prefs(uid, p)
    return p


@router.post("/sleep", response_model=SleepNight)
def log_night(body: ManualNight, uid: int = Depends(current_user_id)):
    """Log a night by hand; one night per wake date, a new entry replaces the old."""
    bed, wake = body.bed.replace(tzinfo=None), body.wake.replace(tzinfo=None)
    minutes = int((wake - bed).total_seconds() // 60)
    if not 60 <= minutes <= 16 * 60:
        raise HTTPException(422, "a night must be between 1 and 16 hours")
    night = SleepNight(
        day=wake.date(), bedtime=bed, wake_time=wake, duration_min=minutes, efficiency=MANUAL_EFFICIENCY,
        deep_min=0, rem_min=0, light_min=minutes, awake_min=0, source="manual",
    )
    store.add_nights(uid, [night])
    return night


@router.get("/squad", response_model=SquadInfo | None)
def my_squad(uid: int = Depends(current_user_id)):
    return store.get_squad(uid)


@router.post("/squad", response_model=SquadInfo, status_code=201)
def create_squad(body: SquadCreate, uid: int = Depends(current_user_id)):
    name = body.name.strip()
    if not 2 <= len(name) <= 30:
        raise HTTPException(422, "squad name must be 2-30 characters")
    squad = store.create_squad(uid, name)
    if squad is None:
        raise HTTPException(409, "that squad name is taken")
    return squad


@router.post("/squad/join", response_model=SquadInfo)
def join_squad(body: SquadJoin, uid: int = Depends(current_user_id)):
    squad = store.join_squad(uid, body.code)
    if squad is None:
        raise HTTPException(404, "no squad with that code")
    return squad
