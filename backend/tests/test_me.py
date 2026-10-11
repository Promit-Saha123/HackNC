from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.auth import make_token
from app.main import app
from app.routes import leaderboard, me
from app.store import Store


def client(monkeypatch, uid=1):
    store = Store()
    for mod in (me, leaderboard):
        monkeypatch.setattr(mod, "store", store)
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {make_token(uid)}"
    return c, store


def test_requires_token(monkeypatch):
    c, _ = client(monkeypatch)
    c.headers.clear()
    assert c.get("/me/prefs").status_code == 401
    assert c.post("/me/sleep", json={}).status_code == 401


def test_prefs_roundtrip_and_hide_from_board(monkeypatch):
    c, _ = client(monkeypatch)
    assert c.get("/me/prefs").json()["hours"] == 8
    p = {"bedtime": 1380, "wake": 450, "hours": 7.5, "share_details": False, "show_on_board": False}
    assert c.put("/me/prefs", json=p).json() == p
    assert c.get("/me/prefs").json() == p
    assert c.put("/me/prefs", json={**p, "hours": 30}).status_code == 422
    assert 1 not in [e["user_id"] for e in c.get("/leaderboard?period=all").json()["entries"]]


def test_manual_log_replaces_same_day_and_keeps_demo(monkeypatch):
    c, store = client(monkeypatch)
    day = date.today() + timedelta(days=1)  # a night with no seed data
    bed, wake = f"{day - timedelta(days=1)}T23:00:00", f"{day}T07:00:00"
    r = c.post("/me/sleep", json={"bed": bed, "wake": wake})
    assert r.status_code == 200 and r.json()["duration_min"] == 480 and r.json()["source"] == "manual"
    c.post("/me/sleep", json={"bed": f"{day - timedelta(days=1)}T23:30:00", "wake": wake})
    assert [n for n in store.nights[1] if n.day == day][0].duration_min == 450
    assert len([n for n in store.nights[1] if n.day == day]) == 1
    assert store.users[1].is_demo  # a manual log doesn't turn a demo profile into a real one
    assert c.post("/me/sleep", json={"bed": wake, "wake": bed}).status_code == 422


def test_squads(monkeypatch):
    c, _ = client(monkeypatch)
    assert c.get("/me/squad").json()["name"] == "Wolfpack"
    r = c.post("/me/squad", json={"name": "Study Buddies"})
    assert r.status_code == 201 and r.json()["code"].startswith("STUD")
    assert c.post("/me/squad", json={"name": "study buddies"}).status_code == 409
    assert c.post("/me/squad/join", json={"code": "owls42"}).json()["name"] == "Night Owls"
    assert c.get("/me/squad").json()["name"] == "Night Owls"
    assert c.post("/me/squad/join", json={"code": "NOPE00"}).status_code == 404


def test_friend_card_privacy(monkeypatch):
    c, store = client(monkeypatch, uid=2)  # Jordan looks at Maya (1)
    card = c.get("/users/1/card").json()
    assert card["name"] == "Maya" and card["score"] and card["details"]["avg_hours"] > 6
    assert 20 * 60 <= card["details"]["avg_bedtime"] < 24 * 60
    p = store.get_prefs(1)
    store.set_prefs(1, p.model_copy(update={"share_details": False}))
    card = c.get("/users/1/card").json()
    assert card["details"] is None and card["streak_days"] >= 0  # score + streak still visible
    store.set_prefs(1, p.model_copy(update={"show_on_board": False}))
    assert c.get("/users/1/card").status_code == 404  # hidden from others
    c.headers["Authorization"] = f"Bearer {make_token(1)}"
    assert c.get("/users/1/card").status_code == 200  # but not from themselves
    c.headers.clear()
    assert c.get("/users/1/card").status_code == 401
    assert c.get("/users/999/card", headers={"Authorization": f"Bearer {make_token(1)}"}).status_code == 404
