"""The signed-in user's own data: profile, goals/privacy, manual sleep log, squad. The user always comes from the bearer token."""
from fastapi import APIRouter, Depends, HTTPException

from ..auth import (
    check_new_password, check_password, check_rate, clean_username, clear_fails, current_user_id, hash_password,
    record_fail,
)
from ..models import (
    ManualNight, PasswordChange, Prefs, Profile, ProfileUpdate, SleepNight, SquadCreate, SquadInfo, SquadJoin,
    SyncStatus,
)
from ..store import NameTaken, store

router = APIRouter(prefix="/me")

MANUAL_EFFICIENCY = 0.9  # no stage data for a hand-typed night, so assume a typical efficiency


@router.get("", response_model=Profile)
def get_me(uid: int = Depends(current_user_id)):
    profile = store.get_profile(uid)
    if profile is None:
        raise HTTPException(401, "that account no longer exists")
    return profile


@router.put("", response_model=Profile)
def update_me(body: ProfileUpdate, uid: int = Depends(current_user_id)):
    """Change name, avatar or bio. Demo profiles are shared, so they are read-only."""
    current = store.get_profile(uid)
    if current is None:
        raise HTTPException(401, "that account no longer exists")
    if current.is_demo:
        raise HTTPException(403, "demo profiles can't be edited")
    name = clean_username(body.name) if body.name is not None else None
    if body.avatar is not None and len(body.avatar.strip()) > 16:
        raise HTTPException(422, "avatar must be at most 16 characters")
    if body.bio is not None and len(body.bio.strip()) > 160:
        raise HTTPException(422, "bio must be at most 160 characters")
    try:
        return store.update_profile(
            uid, name, None if body.avatar is None else body.avatar.strip(), None if body.bio is None else body.bio.strip()
        )
    except NameTaken:
        raise HTTPException(409, "That username is taken.") from None


@router.post("/password", status_code=204)
def change_password(body: PasswordChange, uid: int = Depends(current_user_id)):
    """Needs the current password. Demo profiles share one password, so they can't change it."""
    key = f"pw:{uid}"
    check_rate(key, 10, 300)
    cred = store.credentials(uid)
    if cred is None:
        raise HTTPException(401, "that account no longer exists")
    hashed, is_demo = cred
    if is_demo:
        raise HTTPException(403, "demo profiles share a password and can't change it")
    if hashed is None or not check_password(body.current_password, hashed, False):
        record_fail(key)
        raise HTTPException(403, "Your current password is wrong.")  # 403, not 401, so the app doesn't sign the user out
    clear_fails(key)
    store.set_password(uid, hash_password(check_new_password(body.new_password)))


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


@router.post("/squad/leave", status_code=204)
def leave_squad(uid: int = Depends(current_user_id)):
    store.leave_squad(uid)


@router.get("/sync", response_model=SyncStatus)
def sync_status(uid: int = Depends(current_user_id)):
    """Apple Health row on Profile: has the Shortcut synced, and when."""
    return store.sync_status(uid)
