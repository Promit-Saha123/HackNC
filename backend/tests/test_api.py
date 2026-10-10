from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def test_users_seeded():
    users = c.get("/users").json()
    assert len(users) == 8 and all(u["is_demo"] for u in users)


def test_overview():
    o = c.get("/users/1/overview").json()
    assert len(o["history"]) == 7 and 0 <= o["score"]["score"] <= 100
    assert c.get("/users/999/overview").status_code == 404


def test_leaderboard_sorted_and_squad_filter():
    for period in ("week", "all"):
        scores = [e["score"] for e in c.get(f"/leaderboard?period={period}").json()["entries"]]
        assert scores and scores == sorted(scores, reverse=True)
    squad = c.get("/leaderboard?period=all&squad=Wolfpack").json()["entries"]
    assert {e["squad"] for e in squad} == {"Wolfpack"}


def test_ai_stubs():
    assert "not medical advice" in c.get("/ai/briefing/1").json()["text"]
    assert c.get("/ai/audio/missing.mp3").status_code == 404
    assert c.post("/ingest/1/token").status_code == 501