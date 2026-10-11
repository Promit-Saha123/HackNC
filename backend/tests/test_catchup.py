import pytest
from fastapi.testclient import TestClient

from app.auth import make_token
from app.main import app
from app.models import Prefs
from app.routes import leaderboard, me, sleep
from app.scoring import duration_part, is_streak_night
from app.store import Store

c = TestClient(app)
bearer = lambda uid: {"Authorization": f"Bearer {make_token(uid)}"}  # noqa: E731


@pytest.fixture
def mem(monkeypatch):
    """One fresh in-memory store shared by every route module."""
    s = Store()
    for module in (sleep, me, leaderboard):
        monkeypatch.setattr(module, "store", s)
    return s


def test_history(mem):
    nights = c.get("/users/1/history?days=10").json()
    assert len(nights) == 10
    assert [n["day"] for n in nights] == sorted(n["day"] for n in nights)  # oldest first
    assert all(n["score"] and n["duration_min"] and n["deep_min"] is not None and n["bedtime"] for n in nights)
    assert len(c.get("/users/1/history").json()) == 60  # default window
    assert c.get("/users/1/history?days=0").status_code == 422
    assert c.get("/users/999/history").status_code == 404


def test_goal_hours_default_scores_unchanged():
    for h in (4, 5, 6, 7, 8, 9, 10, 11, 12):  # same shape as the original 5/7/10 h thresholds at the 8 h default
        old = 0.0 if h < 5 else (h - 5) / 2 if h < 7 else 1.0 if h <= 10 else max(0.7, 1 - 0.1 * (h - 10))
        assert duration_part(h * 60) == duration_part(h * 60, 8.0) == old
    assert duration_part(7 * 60, 9) == 0.5 and duration_part(6 * 60, 9) == 0.0  # longer goal, harder to hit
    assert duration_part(4 * 60, 6) == 0.5 and duration_part(6 * 60, 6) == 1.0  # shorter goal, easier
    assert is_streak_night(6 * 60, 0, 7) and not is_streak_night(6 * 60, 0, 8)


def test_changing_hours_goal_rescores_history(mem):
    before = [s.score for s in mem.scores[1]]
    mem.set_prefs(1, Prefs(hours=12))  # Maya sleeps ~8 h, so a 12 h goal costs her duration points
    assert mem.scores[1][-1].score < before[-1]
    mem.set_prefs(1, Prefs(hours=8))
    assert [s.score for s in mem.scores[1]] == before


def test_squad_leave_and_members(mem):
    assert [m["name"] for m in c.get("/squads/wolf23").json()["members"]] == ["Maya", "Jordan", "Sam"]  # case-insensitive code
    mem.set_prefs(2, Prefs(show_on_board=False))
    assert "Jordan" not in [m["name"] for m in c.get("/squads/WOLF23").json()["members"]]
    assert c.post("/me/squad/leave").status_code == 401
    assert c.post("/me/squad/leave", headers=bearer(1)).status_code == 204
    assert c.get("/me/squad", headers=bearer(1)).json() is None
    assert "Maya" not in [m["name"] for m in c.get("/squads/WOLF23").json()["members"]]
    assert c.get("/squads/NOPE00").status_code == 404


def test_sync_status(mem):
    assert c.get("/me/sync", headers=bearer(1)).json() == {"connected": False, "last_sync_at": None, "nights_synced": 0}
    line = "2026-10-09T23:40:00-04:00|2026-10-10T07:20:00-04:00|Core"
    assert c.post("/sleep/shortcut", content=line, headers={"X-User-Id": "1"}).json()["nights_found"] == 1
    s = c.get("/me/sync", headers=bearer(1)).json()
    assert s["connected"] and s["nights_synced"] == 1 and s["last_sync_at"]
    assert c.get("/me/sync").status_code == 401


def test_strict_privacy_is_off_by_default_and_gates_when_on(mem, monkeypatch):
    for path in ("/users/1/overview", "/users/1/history"):
        assert c.get(path).status_code == 200  # default: open, so the app keeps working
    monkeypatch.setattr("app.auth.settings.strict_privacy", True)
    for path in ("/users/1/overview", "/users/1/history"):
        assert c.get(path).status_code == 403  # no token
        assert c.get(path, headers=bearer(2)).status_code == 403  # someone else's token
        assert c.get(path, headers=bearer(1)).status_code == 200  # your own data
    assert c.get("/leaderboard?period=week").status_code == 200  # boards stay public: score + streak only
