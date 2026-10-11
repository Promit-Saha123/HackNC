from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)


def test_users_seeded():
    users = c.get("/users").json()
    assert len([u for u in users if u["is_demo"]]) == 8  # real users (non-demo) may also exist


def test_improved_and_squads():
    imp = c.get("/leaderboard?period=improved").json()["entries"]
    assert all(e["delta"] > 0 for e in imp)  # improvers only, never a "worst" list
    assert [e["delta"] for e in imp] == sorted((e["delta"] for e in imp), reverse=True)
    sq = c.get("/leaderboard/squads?period=all").json()["entries"]
    assert [e["rank"] for e in sq] == list(range(1, len(sq) + 1))
    assert [e["score"] for e in sq] == sorted((e["score"] for e in sq), reverse=True)


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
    assert c.post("/ingest/token").status_code == 401  # needs login

def test_streak_extras_and_prev_rank():
    o = c.get("/users/1/overview").json()
    assert o["best_streak"] >= o["streak_days"]
    assert o["history"][-1]["bedtime"] and o["history"][-1]["wake_time"]
    e = c.get("/leaderboard?period=all").json()["entries"]
    assert all(x["prev_rank"] is None or x["prev_rank"] >= 1 for x in e) and any(x["prev_rank"] for x in e)
