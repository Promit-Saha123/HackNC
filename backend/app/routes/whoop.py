"""WHOOP: connect (OAuth), sync, status, disconnect, and the webhook that syncs new nights automatically.
The client secret never leaves the server: the app only gets a URL to open, then reads /me/whoop for the result."""
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from html import escape

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import HTMLResponse

from ..auth import current_user_id
from ..integrations import whoop
from ..models import WhoopConnectUrl, WhoopStatus, WhoopSyncResult
from ..store import store

router = APIRouter()
log = logging.getLogger("whoop")

SYNC_DAYS = 14  # how far back a manual sync or the first import looks
# state -> (user_id, expires_at). The state is single use, 10 minutes, and ties the callback to the signed-in user.
# ponytail: in memory, so a restart while someone is on WHOOP's consent page loses it and they tap Connect again.
_pending: dict[str, tuple[int, float]] = {}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _need_whoop() -> None:
    if not whoop.configured():
        raise HTTPException(503, "WHOOP isn't set up on this server yet")


def _sync(uid: int, days: int = SYNC_DAYS) -> int:
    """Pull the last `days` of sleep from WHOOP into the user's nights. Returns how many nights were found."""
    conn = store.get_whoop(uid)
    if conn is None:
        raise HTTPException(409, "WHOOP isn't connected")
    save = lambda access, refresh, expires: store.update_whoop_tokens(uid, access, refresh, expires)  # noqa: E731
    since = _utcnow() - timedelta(days=days)
    try:
        try:
            records = whoop.fetch_sleeps(whoop.fresh_access_token(conn, save), since)
        except whoop.WhoopError as e:
            if str(e) != "unauthorized":
                raise
            conn = {**conn, "expires_at": _utcnow() - timedelta(days=1)}  # rejected early: force one refresh, retry once
            records = whoop.fetch_sleeps(whoop.fresh_access_token(conn, save), since)
    except whoop.WhoopError as e:
        log.warning("WHOOP sync failed for user %s: %s", uid, e)
        raise HTTPException(502, "WHOOP isn't responding or access was revoked. Try reconnecting.") from e
    nights = whoop.to_nights(records)
    if nights:
        store.add_nights(uid, nights)
    store.touch_whoop(uid)
    return len(nights)


def _page(title: str, message: str, status: int = 200) -> HTMLResponse:
    """The tiny page shown in the browser tab after WHOOP sends the user back."""
    body = (f"<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
            f"<title>{escape(title)}</title><body style='font-family:system-ui;max-width:28rem;margin:18vh auto;padding:0 1.5rem;"
            f"text-align:center'><h1>{escape(title)}</h1><p style='color:#555'>{escape(message)}</p></body>")
    return HTMLResponse(body, status_code=status)


@router.get("/me/whoop", response_model=WhoopStatus)
def whoop_status(uid: int = Depends(current_user_id)):
    status = store.whoop_status(uid)
    status.configured = whoop.configured()
    return status


@router.post("/me/whoop/connect", response_model=WhoopConnectUrl)
def whoop_connect(uid: int = Depends(current_user_id)):
    """Returns the WHOOP consent URL for the app to open in a browser."""
    _need_whoop()
    now = time.time()
    for k in [k for k, (_, exp) in _pending.items() if exp < now]:
        del _pending[k]  # forget expired attempts
    state = secrets.token_urlsafe(6)  # exactly 8 characters, the length WHOOP asks for
    _pending[state] = (uid, now + 600)
    return WhoopConnectUrl(url=whoop.authorize_url(state))


@router.get("/whoop/callback", response_class=HTMLResponse)
def whoop_callback(code: str = "", state: str = "", error: str = ""):
    """WHOOP sends the user's browser here after consent. Public on purpose: the single-use state proves who started it."""
    entry = _pending.pop(state, None)
    if error or not code or entry is None or entry[1] < time.time():
        return _page("WHOOP wasn't connected", "That link expired or access was declined. Go back to Sleep Squad and tap Connect WHOOP again.", 400)
    uid = entry[0]
    try:
        tok = whoop.exchange_code(code)
        if not tok.get("refresh_token"):
            return _page("WHOOP wasn't connected", "WHOOP didn't grant long-term access. Tap Connect WHOOP again and accept every permission.", 400)
        wid = whoop.profile_user_id(tok["access_token"])
        if store.whoop_uid(wid) not in (None, uid):
            return _page("Already linked", "That WHOOP account is already linked to another Sleep Squad account.", 409)
        expires = _utcnow() + timedelta(seconds=int(tok.get("expires_in", 3600)))
        store.save_whoop(uid, wid, tok["access_token"], tok["refresh_token"], expires, tok.get("scope", whoop.SCOPES))
        nights = _sync(uid)
    except (whoop.WhoopError, HTTPException, KeyError) as e:
        log.warning("WHOOP connect failed for user %s: %s", uid, e)
        return _page("WHOOP wasn't connected", "WHOOP didn't respond as expected. Please try again in a minute.", 502)
    return _page("WHOOP connected", f"Imported {nights} night{'s' if nights != 1 else ''}. You can close this tab and go back to Sleep Squad.")


@router.post("/me/whoop/sync", response_model=WhoopSyncResult)
def whoop_sync(uid: int = Depends(current_user_id)):
    return WhoopSyncResult(nights_found=_sync(uid))


@router.delete("/me/whoop", status_code=204)
def whoop_disconnect(uid: int = Depends(current_user_id)):
    """Revoke our access at WHOOP and forget the tokens. Nights already imported stay (they're the user's data)."""
    conn = store.get_whoop(uid)
    if conn:
        whoop.revoke(conn["access_token"])
        store.delete_whoop(uid)


def _sync_quietly(uid: int) -> None:
    try:
        _sync(uid, days=3)  # a webhook only says "something changed", so re-read the last few days
    except Exception as e:  # runs after the response, so there is nobody to tell; WHOOP retries on a non-2xx, not on this
        log.warning("WHOOP webhook sync failed for user %s: %s", uid, e)


@router.post("/whoop/webhook", status_code=204)
async def whoop_webhook(
    request: Request, background: BackgroundTasks,
    x_whoop_signature: str = Header(""), x_whoop_signature_timestamp: str = Header(""),
):
    """WHOOP pushes sleep.updated when a night is scored. Verify the signature, answer fast, sync in the background."""
    body = await request.body()
    if not whoop.verify_webhook(x_whoop_signature, x_whoop_signature_timestamp, body):
        raise HTTPException(401, "bad signature")
    try:
        event = json.loads(body or b"{}")
        wid = int(event["user_id"]) if event.get("type") == "sleep.updated" else None
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "malformed event") from None
    uid = store.whoop_uid(wid) if wid is not None else None
    if uid is not None:
        background.add_task(_sync_quietly, uid)
