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
    monkeypatch.setattr(sleep, "store", Store())
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