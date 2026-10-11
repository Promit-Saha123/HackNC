from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.routes import sleep
from app.store import Store

SAMPLE = """2026-10-09T23:30:00-04:00|2026-10-10T07:30:00-04:00|In Bed
2026-10-09T23:40:00-04:00|2026-10-10T01:00:00-04:00|Core
2026-10-10T01:00:00-04:00|2026-10-10T01:40:00-04:00|Deep
2026-10-10T01:40:00-04:00|2026-10-10T02:30:00-04:00|REM
2026-10-10T02:30:00-04:00|2026-10-10T02:40:00-04:00|Awake
2026-10-10T02:40:00-04:00|2026-10-10T07:20:00-04:00|Core
not a sample line
"""


def test_parse_and_ingest(monkeypatch):
    # pin the seed's last night to the SAMPLE's wake date, or this test breaks when the calendar rolls over
    monkeypatch.setattr(sleep, "store", Store(today=date(2026, 10, 10)))
    c = TestClient(app)
    r = c.post("/sleep/shortcut", content=SAMPLE, headers={"X-User-Id": "1", "Content-Type": "text/plain"})
    assert r.status_code == 200
    assert r.json() == {"user_id": 1, "samples_parsed": 6, "samples_skipped": 1, "nights_found": 1}
    night = sleep.store.overview(1).last_night
    assert (night.day.isoformat(), night.duration_min, night.deep_min, night.rem_min) == ("2026-10-10", 450, 40, 50)
    assert night.efficiency == 0.938


def test_unknown_user_404():
    r = TestClient(app).post("/sleep/shortcut", content=SAMPLE, headers={"X-User-Id": "999"})
    assert r.status_code == 404

def test_ingest_token(monkeypatch):
    from app.auth import make_ingest_token, make_token

    store = Store()
    store.users[1] = store.users[1].model_copy(update={"is_demo": False})  # pretend Maya is a real user
    monkeypatch.setattr(sleep, "store", store)
    c = TestClient(app)
    post = lambda h: c.post("/sleep/shortcut", content=SAMPLE, headers=h).status_code  # noqa: E731
    assert post({"X-User-Id": "1"}) == 200  # plain X-User-Id works for real users too (team decision: no token required)
    assert post({"X-User-Id": "2"}) == 200  # and for demo profiles
    assert post({"X-Ingest-Token": make_ingest_token(1)}) == 200
    assert post({"X-Ingest-Token": make_ingest_token(1)[:-2] + "00"}) == 401  # forged
    assert post({}) == 401
    assert post({"X-Ingest-Token": make_token(1)}) == 401  # a login token isn't an ingest token
    r = c.post("/ingest/token", headers={"Authorization": f"Bearer {make_token(1)}"})
    assert r.json()["token"] == make_ingest_token(1)
    assert c.post("/ingest/token").status_code == 401
