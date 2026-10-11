"""WHOOP: OAuth 2.0 + sleep import. Only sleep is read: scopes read:sleep, read:profile (just the numeric WHOOP user id,
needed to match webhooks to a user; name and email are never stored) and offline (a refresh token, so syncs keep working).
Docs: https://developer.whoop.com/docs/developing/oauth and /api. API v2, sleep ids are UUIDs.
Everything here is plain functions so routes/whoop.py and the tests can swap them out."""
import base64
import datetime as dt
import hashlib
import hmac
import threading
from urllib.parse import urlencode

import httpx

from ..config import settings
from ..models import SleepNight

AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth"
TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token"
API = "https://api.prod.whoop.com/developer/v2"
SCOPES = "offline read:sleep read:profile"
MIN_ASLEEP_MIN = 30  # same floor as the Shortcut parser: ignore naps and noise
# Refresh tokens rotate: using one kills the old one, and two concurrent refreshes make the second fail. One lock for all
# users is fine at our scale. ponytail: per-process, move to a DB row lock if the API ever runs several workers.
_refresh_lock = threading.Lock()


class WhoopError(Exception):
    """WHOOP rejected a call (bad credentials, revoked access, outage)."""


def configured() -> bool:
    return bool(settings.whoop_client_id and settings.whoop_client_secret)


def redirect_uri() -> str:
    return settings.public_url.rstrip("/") + "/whoop/callback"  # must match a Redirect URL registered in the WHOOP dashboard


def authorize_url(state: str) -> str:
    q = {"response_type": "code", "client_id": settings.whoop_client_id, "redirect_uri": redirect_uri(), "scope": SCOPES, "state": state}
    return f"{AUTH_URL}?{urlencode(q)}"


def _token_call(data: dict) -> dict:
    try:
        r = httpx.post(TOKEN_URL, data={**data, "client_id": settings.whoop_client_id, "client_secret": settings.whoop_client_secret}, timeout=20)
    except httpx.HTTPError as e:
        raise WhoopError(f"could not reach WHOOP: {e.__class__.__name__}") from e
    if r.status_code != 200:
        raise WhoopError(f"WHOOP token request failed ({r.status_code})")
    return r.json()


def exchange_code(code: str) -> dict:
    """Authorization code -> {access_token, refresh_token, expires_in, scope}."""
    return _token_call({"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri()})


def refresh(refresh_token: str) -> dict:
    """Rotating refresh: the returned refresh_token replaces the one passed in, so the caller must save it at once."""
    return _token_call({"grant_type": "refresh_token", "refresh_token": refresh_token, "scope": "offline"})


def _get(path: str, access_token: str, params: dict | None = None) -> dict:
    try:
        r = httpx.get(API + path, params=params, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
    except httpx.HTTPError as e:
        raise WhoopError(f"could not reach WHOOP: {e.__class__.__name__}") from e
    if r.status_code == 401:
        raise WhoopError("unauthorized")  # expired or revoked: the caller refreshes once, then asks the user to reconnect
    if r.status_code != 200:
        raise WhoopError(f"WHOOP request failed ({r.status_code})")
    return r.json()


def profile_user_id(access_token: str) -> int:
    return int(_get("/user/profile/basic", access_token)["user_id"])


def fetch_sleeps(access_token: str, since: dt.datetime) -> list[dict]:
    """All sleep records that started at or after `since` (naive UTC), following WHOOP's pagination (25 per page)."""
    records, token = [], None
    for _ in range(40):  # hard stop: 1000 records is far more than we ever need
        params = {"limit": 25, "start": since.strftime("%Y-%m-%dT%H:%M:%S.000Z")}
        if token:
            params["nextToken"] = token
        page = _get("/activity/sleep", access_token, params)
        records += page.get("records", [])
        token = page.get("next_token")
        if not token:
            break
    return records


def fetch_sleep(access_token: str, sleep_id: str) -> dict:
    return _get(f"/activity/sleep/{sleep_id}", access_token)


def revoke(access_token: str) -> None:
    """Tell WHOOP the user disconnected (also stops webhooks for them). Best effort: we delete our copy either way."""
    try:
        httpx.delete(API + "/user/access", headers={"Authorization": f"Bearer {access_token}"}, timeout=15)
    except httpx.HTTPError:
        pass


def _utc(s: str) -> dt.datetime:
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(dt.timezone.utc).replace(tzinfo=None)


def _offset(s: str) -> dt.timedelta:
    sign = -1 if s.startswith("-") else 1
    h, m = s.lstrip("+-").split(":")
    return sign * dt.timedelta(hours=int(h), minutes=int(m))


def to_night(rec: dict) -> SleepNight | None:
    """One WHOOP sleep record -> our SleepNight, in the device-local wall-clock time the rest of the app uses
    (UTC + the record's timezone_offset). None for naps, unscored sleeps and anything under 30 minutes asleep."""
    if rec.get("nap") or rec.get("score_state") != "SCORED" or not rec.get("score"):
        return None
    s = rec["score"]["stage_summary"]
    mins = lambda k: int(round((s.get(k) or 0) / 60000))  # noqa: E731  milliseconds -> minutes
    light, deep, rem, awake = mins("total_light_sleep_time_milli"), mins("total_slow_wave_sleep_time_milli"), mins("total_rem_sleep_time_milli"), mins("total_awake_time_milli")
    asleep = light + deep + rem
    if asleep < MIN_ASLEEP_MIN:
        return None
    off = _offset(rec.get("timezone_offset") or "+00:00")
    bed, wake = _utc(rec["start"]) + off, _utc(rec["end"]) + off
    in_bed = max(mins("total_in_bed_time_milli"), asleep + awake, 1)
    return SleepNight(
        day=wake.date(), bedtime=bed, wake_time=wake, duration_min=asleep, efficiency=round(min(1.0, asleep / in_bed), 3),
        deep_min=deep, rem_min=rem, light_min=light, awake_min=max(0, in_bed - asleep), source="whoop",
    )


def to_nights(records: list[dict]) -> list[SleepNight]:
    """Convert and keep the longest night per wake date (same rule as the Shortcut parser), oldest first."""
    best: dict = {}
    for rec in records:
        n = to_night(rec)
        if n and (n.day not in best or n.duration_min > best[n.day].duration_min):
            best[n.day] = n
    return sorted(best.values(), key=lambda n: n.day)


def verify_webhook(signature: str, timestamp: str, body: bytes) -> bool:
    """WHOOP signs timestamp + raw body with HMAC-SHA256 keyed by the client secret, base64-encoded."""
    if not (settings.whoop_client_secret and signature and timestamp):
        return False
    mac = hmac.new(settings.whoop_client_secret.encode(), timestamp.encode() + body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(mac).decode(), signature)


def fresh_access_token(conn: dict, save) -> str:
    """The user's access token, refreshed first if it expires within a minute. `save(access, refresh, expires_at)` stores
    the rotated pair; it runs inside the lock so two requests can't both spend the same refresh token."""
    if conn["expires_at"] - dt.timedelta(seconds=60) > dt.datetime.now(dt.timezone.utc).replace(tzinfo=None):
        return conn["access_token"]
    with _refresh_lock:
        tok = refresh(conn["refresh_token"])
        expires = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(seconds=int(tok.get("expires_in", 3600)))
        save(tok["access_token"], tok["refresh_token"], expires)
    return tok["access_token"]
