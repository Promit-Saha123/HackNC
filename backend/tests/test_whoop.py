import base64
import datetime as dt
import hashlib
import hmac
import json
import re

import pytest
from fastapi.testclient import TestClient

from app.auth import make_token
from app.integrations import whoop
from app.main import app
from app.routes import sleep
from app.routes import whoop as whoop_routes
from app.store import Store

c = TestClient(app)
bearer = lambda uid: {"Authorization": f"Bearer {make_token(uid)}"}  # noqa: E731
MIN = 60_000  # milliseconds per minute

# 00:10 -> 08:20 local (UTC-4), 250 light + 100 deep + 110 rem = 460 min asleep, 30 awake, 490 in bed
REC = {
    "id": "ecfc6a15-4661-442f-a9a4-f160dd7afae8", "user_id": 10129, "nap": False, "score_state": "SCORED",
    "start": "2026-10-11T04:10:00.000Z", "end": "2026-10-11T12:20:00.000Z", "timezone_offset": "-04:00",
    "score": {"stage_summary": {
        "total_in_bed_time_milli": 490 * MIN, "total_awake_time_milli": 30 * MIN, "total_light_sleep_time_milli": 250 * MIN,
        "total_slow_wave_sleep_time_milli": 100 * MIN, "total_rem_sleep_time_milli": 110 * MIN}},
}


def rec(**over):
    return {**REC, **over}


@pytest.fixture
def env(monkeypatch):
    """Fresh in-memory store, fake WHOOP credentials, and WHOOP's network calls replaced by recorders."""
    s = Store()
    for module in (whoop_routes, sleep):
        monkeypatch.setattr(module, "store", s)
    monkeypatch.setattr(whoop.settings, "whoop_client_id", "cid")
    monkeypatch.setattr(whoop.settings, "whoop_client_secret", "sekret")
    monkeypatch.setattr(whoop.settings, "public_url", "https://api.test")
    whoop_routes._pending.clear()
    calls = {"revoke": [], "refresh": [], "fetch": 0}
    monkeypatch.setattr(whoop, "exchange_code", lambda code: {"access_token": "AT", "refresh_token": "RT", "expires_in": 3600, "scope": whoop.SCOPES})
    monkeypatch.setattr(whoop, "profile_user_id", lambda token: 10129)
    monkeypatch.setattr(whoop, "revoke", lambda token: calls["revoke"].append(token))

    def fetch(token, since):
        calls["fetch"] += 1
        return [REC]

    monkeypatch.setattr(whoop, "fetch_sleeps", fetch)
    return s, calls


def connect(uid=1):
    """Run the whole consent round trip and return the callback response."""
    url = c.post("/me/whoop/connect", headers=bearer(uid)).json()["url"]
    return c.get("/whoop/callback", params={"code": "abc", "state": re.search(r"state=([^&]+)", url).group(1)})


# ---------- mapping ----------

def test_to_night_converts_to_local_wall_clock_and_minutes():
    n = whoop.to_night(REC)
    assert (n.day.isoformat(), n.bedtime.isoformat(), n.wake_time.isoformat()) == ("2026-10-11", "2026-10-11T00:10:00", "2026-10-11T08:20:00")
    assert (n.duration_min, n.deep_min, n.rem_min, n.light_min, n.awake_min, n.efficiency, n.source) == (460, 100, 110, 250, 30, 0.939, "whoop")


def test_to_night_skips_naps_unscored_and_tiny_sleeps():
    assert whoop.to_night(rec(nap=True)) is None
    assert whoop.to_night(rec(score_state="PENDING_SCORE")) is None
    assert whoop.to_night(rec(score=None)) is None
    short = {"stage_summary": {"total_light_sleep_time_milli": 20 * MIN}}
    assert whoop.to_night(rec(score=short)) is None  # under 30 min asleep, like the Shortcut parser


def test_to_nights_keeps_the_longest_per_wake_date_oldest_first():
    other_day = rec(end="2026-10-10T12:00:00.000Z", start="2026-10-10T04:00:00.000Z")
    split = rec(id="b", score={"stage_summary": {"total_light_sleep_time_milli": 60 * MIN}})  # same wake date, shorter
    out = whoop.to_nights([REC, split, other_day])
    assert [n.day.isoformat() for n in out] == ["2026-10-10", "2026-10-11"] and out[1].duration_min == 460


# ---------- OAuth URL, tokens, webhook signature ----------

def test_authorize_url_asks_for_sleep_only(env):
    url = whoop.authorize_url("S3cretSt")
    assert url.startswith(whoop.AUTH_URL + "?") and "client_id=cid" in url and "state=S3cretSt" in url
    assert "redirect_uri=https%3A%2F%2Fapi.test%2Fwhoop%2Fcallback" in url
    assert whoop.SCOPES == "offline read:sleep read:profile"  # no recovery, workouts, body measurements or cycles


def test_fresh_access_token_only_refreshes_when_expiring_and_saves_the_rotated_pair(monkeypatch):
    saved, spent = [], []
    monkeypatch.setattr(whoop, "refresh", lambda rt: spent.append(rt) or {"access_token": "A2", "refresh_token": "R2", "expires_in": 3600})
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    live = {"access_token": "A1", "refresh_token": "R1", "expires_at": now + dt.timedelta(hours=1)}
    assert whoop.fresh_access_token(live, lambda *a: saved.append(a)) == "A1" and not spent
    old = {**live, "expires_at": now - dt.timedelta(minutes=5)}
    assert whoop.fresh_access_token(old, lambda *a: saved.append(a)) == "A2"
    assert spent == ["R1"] and saved[0][:2] == ("A2", "R2")  # the new refresh token was stored, since WHOOP killed R1


def sign(body: bytes, ts="1700000000000", secret=b"sekret"):
    return base64.b64encode(hmac.new(secret, ts.encode() + body, hashlib.sha256).digest()).decode(), ts


def test_verify_webhook_follows_whoops_algorithm(env):
    body = b'{"user_id":10129,"id":"x","type":"sleep.updated","trace_id":"t"}'
    sig, ts = sign(body)
    assert whoop.verify_webhook(sig, ts, body)
    assert not whoop.verify_webhook(sig, ts, body + b" ")  # body changed
    assert not whoop.verify_webhook(sig, "1700000000001", body)  # timestamp changed
    assert not whoop.verify_webhook(sign(body, secret=b"other")[0], ts, body)  # wrong secret
    assert not whoop.verify_webhook("", ts, body)


# ---------- connect / callback / sync / disconnect ----------

def test_not_configured_server_says_so(env, monkeypatch):
    monkeypatch.setattr(whoop.settings, "whoop_client_id", "")
    assert c.post("/me/whoop/connect", headers=bearer(1)).status_code == 503
    assert c.get("/me/whoop", headers=bearer(1)).json()["configured"] is False
    assert c.post("/me/whoop/connect").status_code == 401  # and you need to be signed in


def test_connect_flow_imports_nights_and_marks_the_user_real(env):
    s, _ = env
    assert s.users[1].is_demo and c.get("/me/whoop", headers=bearer(1)).json() == {"configured": True, "connected": False, "last_sync_at": None, "nights_synced": 0}
    r = connect(1)
    assert r.status_code == 200 and "WHOOP connected" in r.text and "Imported 1 night." in r.text
    assert not s.users[1].is_demo and s.users[1].source == "whoop"
    assert s.nights[1][-1].source == "whoop" and s.nights[1][-1].duration_min == 460
    st = c.get("/me/whoop", headers=bearer(1)).json()
    assert st["connected"] and st["nights_synced"] == 1 and st["last_sync_at"]
    assert s.get_whoop(1)["refresh_token"] == "RT" and s.whoop_uid(10129) == 1


def test_state_is_single_use_short_and_required(env):
    url = c.post("/me/whoop/connect", headers=bearer(1)).json()["url"]
    state = re.search(r"state=([^&]+)", url).group(1)
    assert len(state) == 8  # the length WHOOP asks for
    assert c.get("/whoop/callback", params={"code": "abc", "state": "nope1234"}).status_code == 400
    assert c.get("/whoop/callback", params={"error": "access_denied", "state": state}).status_code == 400  # user said no
    assert c.get("/whoop/callback", params={"code": "abc", "state": state}).status_code == 400  # ...and that attempt consumed it
    url = c.post("/me/whoop/connect", headers=bearer(1)).json()["url"]
    state = re.search(r"state=([^&]+)", url).group(1)
    assert c.get("/whoop/callback", params={"code": "abc", "state": state}).status_code == 200
    assert c.get("/whoop/callback", params={"code": "abc", "state": state}).status_code == 400  # replay refused


def test_expired_state_is_refused(env, monkeypatch):
    url = c.post("/me/whoop/connect", headers=bearer(1)).json()["url"]
    state = re.search(r"state=([^&]+)", url).group(1)
    uid, _ = whoop_routes._pending[state]
    whoop_routes._pending[state] = (uid, 0.0)  # ten minutes have passed
    assert c.get("/whoop/callback", params={"code": "abc", "state": state}).status_code == 400


def test_one_whoop_account_cannot_be_linked_to_two_users(env):
    assert connect(1).status_code == 200
    r = connect(2)  # same WHOOP user 10129 tries to attach to a second Sleep Squad account
    assert r.status_code == 409 and "already linked" in r.text
    assert env[0].get_whoop(2) is None


def test_missing_refresh_token_is_reported(env, monkeypatch):
    monkeypatch.setattr(whoop, "exchange_code", lambda code: {"access_token": "AT", "expires_in": 3600})
    assert "long-term access" in connect(1).text and env[0].get_whoop(1) is None


def test_manual_sync_and_a_token_rejected_early_is_refreshed_once(env, monkeypatch):
    s, calls = env
    assert connect(1).status_code == 200
    assert c.post("/me/whoop/sync", headers=bearer(1)).json() == {"nights_found": 1}
    attempts = []

    def flaky(token, since):
        attempts.append(token)
        if token == "AT":
            raise whoop.WhoopError("unauthorized")  # access token died before its stated expiry
        return [REC]

    monkeypatch.setattr(whoop, "fetch_sleeps", flaky)
    monkeypatch.setattr(whoop, "refresh", lambda rt: {"access_token": "AT2", "refresh_token": "RT2", "expires_in": 3600})
    assert c.post("/me/whoop/sync", headers=bearer(1)).json() == {"nights_found": 1}
    assert attempts == ["AT", "AT2"] and s.get_whoop(1)["refresh_token"] == "RT2"
    monkeypatch.setattr(whoop, "fetch_sleeps", lambda token, since: (_ for _ in ()).throw(whoop.WhoopError("WHOOP request failed (500)")))
    assert c.post("/me/whoop/sync", headers=bearer(1)).status_code == 502
    assert c.post("/me/whoop/sync", headers=bearer(3)).status_code == 409  # never connected


def test_disconnect_revokes_at_whoop_and_keeps_the_imported_nights(env):
    s, calls = env
    connect(1)
    assert c.delete("/me/whoop", headers=bearer(1)).status_code == 204
    assert calls["revoke"] == ["AT"] and s.get_whoop(1) is None
    assert c.get("/me/whoop", headers=bearer(1)).json()["connected"] is False
    assert s.nights[1][-1].source == "whoop"  # their sleep history stays
    assert c.delete("/me/whoop", headers=bearer(1)).status_code == 204  # idempotent


def test_deleting_the_account_also_revokes_at_whoop(env):
    s, calls = env
    connect(1)  # Maya is now a real (non-demo) user
    assert c.delete("/users/1/data", headers=bearer(1)).status_code == 204
    assert calls["revoke"] == ["AT"] and s.get_user(1) is None and s.get_whoop(1) is None


# ---------- webhook ----------

def post_webhook(body: bytes, sig=None, ts="1700000000000"):
    sig = sig or sign(body, ts)[0]
    return c.post("/whoop/webhook", content=body, headers={"X-WHOOP-Signature": sig, "X-WHOOP-Signature-Timestamp": ts, "Content-Type": "application/json"})


def test_webhook_syncs_the_connected_user_after_responding(env, monkeypatch):
    s, calls = env
    connect(1)
    before = calls["fetch"]
    event = json.dumps({"user_id": 10129, "id": "ecfc6a15-4661-442f-a9a4-f160dd7afae8", "type": "sleep.updated", "trace_id": "t1"}).encode()
    assert post_webhook(event).status_code == 204
    assert calls["fetch"] == before + 1  # one resync of the last few days
    assert post_webhook(json.dumps({"user_id": 999, "id": "x", "type": "sleep.updated"}).encode()).status_code == 204  # nobody we know
    assert calls["fetch"] == before + 1
    assert post_webhook(json.dumps({"user_id": 10129, "id": "x", "type": "recovery.updated"}).encode()).status_code == 204  # not sleep
    assert calls["fetch"] == before + 1


def test_webhook_rejects_bad_signatures_and_malformed_bodies(env):
    connect(1)
    body = b'{"user_id":10129,"id":"x","type":"sleep.updated"}'
    assert post_webhook(body, sig="AAAA").status_code == 401
    assert c.post("/whoop/webhook", content=body).status_code == 401  # no signature at all
    assert post_webhook(b"not json").status_code == 400  # correctly signed, but not an event
    assert post_webhook(b'{"type":"sleep.updated"}').status_code == 400  # no user_id
