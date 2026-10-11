import pytest
from fastapi.testclient import TestClient

from app import auth as auth_core
from app.auth import make_token
from app.main import app
from app.routes import auth, leaderboard, me, sleep
from app.store import Store

c = TestClient(app)
bearer = lambda token: {"Authorization": f"Bearer {token}"}  # noqa: E731


@pytest.fixture(autouse=True)
def mem(monkeypatch):
    """A fresh in-memory store for every route module, and a clean attempt limiter."""
    s = Store()
    for module in (sleep, me, leaderboard, auth):
        monkeypatch.setattr(module, "store", s)
    auth_core._fails.clear()
    yield s
    auth_core._fails.clear()


def signup(name="night_owl", password="correct horse"):
    return c.post("/auth/signup", json={"username": name, "password": password})


def test_signup_then_login_and_me():
    r = signup()
    assert r.status_code == 201 and r.json()["user"]["name"] == "night_owl" and not r.json()["user"]["is_demo"]
    assert c.get("/auth/me", headers=bearer(r.json()["token"])).json()["name"] == "night_owl"
    login = c.post("/auth/login", json={"username": "NIGHT_OWL", "password": "correct horse"})  # case-insensitive
    assert login.status_code == 200 and login.json()["user"]["id"] == r.json()["user"]["id"]
    assert c.post("/auth/login", json={"username": "night_owl", "password": "wrong password"}).status_code == 401


def test_signup_validation_and_duplicates():
    assert signup("ab").status_code == 422  # too short
    assert signup("has space").status_code == 422
    assert signup("fine_name", "short").status_code == 422  # password under 8
    assert signup("fine_name").status_code == 201
    dup = signup("FINE_NAME", "another pass")  # same name, any case
    assert dup.status_code == 409 and "already exists" in dup.json()["detail"]
    assert signup("maya").status_code == 409  # a demo profile's name is taken too


def test_second_signup_while_signed_in_says_an_account_exists():
    token = signup().json()["token"]
    again = c.post("/auth/signup", json={"username": "another_one", "password": "correct horse"}, headers=bearer(token))
    assert again.status_code == 409 and "already have an account (night_owl)" in again.json()["detail"]
    assert c.post("/auth/login", json={"username": "another_one", "password": "correct horse"}).status_code == 401  # not created
    # a shared demo login is not a real account, so that person can still sign up
    demo = c.post("/auth/signup", json={"username": "from_demo", "password": "correct horse"}, headers=bearer(make_token(1)))
    assert demo.status_code == 201


def test_each_account_has_its_own_data(mem):
    a, b = signup("alice_a").json(), signup("bobby_b").json()
    line = "2026-10-09T23:40:00-04:00|2026-10-10T07:20:00-04:00|Core"
    c.post("/sleep/shortcut", content=line, headers={"X-User-Id": str(a["user"]["id"])})
    assert c.get("/me", headers=bearer(a["token"])).json()["stats"]["nights"] == 1
    assert c.get("/me", headers=bearer(b["token"])).json()["stats"]["nights"] == 0  # b sees none of a's nights


def test_real_accounts_are_not_listed_and_start_empty(mem):
    uid = signup().json()["user"]["id"]
    assert uid not in [u["id"] for u in c.get("/users").json()]
    ov = c.get(f"/users/{uid}/overview").json()
    assert ov["last_night"] is None and ov["history"] == []
    assert "night_owl" not in [e["name"] for e in c.get("/leaderboard?period=all").json()["entries"]]


def test_profile_read_and_update():
    token = signup().json()["token"]
    p = c.get("/me", headers=bearer(token)).json()
    assert p["name"] == "night_owl" and p["avatar"] is None and p["stats"] == {"nights": 0, "best_streak": 0, "avg_score": None}
    assert p["member_since"]
    r = c.put("/me", json={"avatar": "😴", "bio": "Trying to beat my roommate."}, headers=bearer(token)).json()
    assert r["avatar"] == "😴" and r["bio"] == "Trying to beat my roommate."
    r = c.put("/me", json={"name": "sleepy_head"}, headers=bearer(token))
    assert r.json()["name"] == "sleepy_head" and r.json()["bio"] == "Trying to beat my roommate."  # untouched fields stay
    assert c.post("/auth/login", json={"username": "sleepy_head", "password": "correct horse"}).status_code == 200
    assert c.put("/me", json={"bio": ""}, headers=bearer(token)).json()["bio"] is None  # empty string clears
    assert c.put("/me", json={"name": "Maya"}, headers=bearer(token)).status_code == 409
    assert c.put("/me", json={"name": "x"}, headers=bearer(token)).status_code == 422
    assert c.put("/me", json={"bio": "x" * 161}, headers=bearer(token)).status_code == 422
    assert c.get("/me").status_code == 401


def test_profile_stats_use_real_nights(mem):
    token = signup().json()["token"]
    uid = c.get("/auth/me", headers=bearer(token)).json()["id"]
    line = "2026-10-09T23:40:00-04:00|2026-10-10T07:20:00-04:00|Core"
    assert c.post("/sleep/shortcut", content=line, headers={"X-User-Id": str(uid)}).json()["nights_found"] == 1
    s = c.get("/me", headers=bearer(token)).json()["stats"]
    assert s["nights"] == 1 and s["avg_score"] is not None


def test_demo_profiles_are_read_only():
    token = make_token(1)  # Maya
    assert c.put("/me", json={"bio": "hacked"}, headers=bearer(token)).status_code == 403
    assert c.post("/me/password", json={"current_password": "sleepsquad", "new_password": "new password"}, headers=bearer(token)).status_code == 403


def test_change_password():
    token = signup().json()["token"]
    change = lambda cur, new: c.post("/me/password", json={"current_password": cur, "new_password": new}, headers=bearer(token))  # noqa: E731
    assert change("not my password", "brand new pass").status_code == 403
    assert change("correct horse", "short").status_code == 422
    assert change("correct horse", "brand new pass").status_code == 204
    assert c.post("/auth/login", json={"username": "night_owl", "password": "correct horse"}).status_code == 401
    assert c.post("/auth/login", json={"username": "night_owl", "password": "brand new pass"}).status_code == 200


def test_login_rate_limit_counts_failures_per_username():
    signup()
    bad = lambda: c.post("/auth/login", json={"username": "night_owl", "password": "nope nope"}).status_code  # noqa: E731
    assert [bad() for _ in range(10)] == [401] * 10
    assert bad() == 429  # locked out
    assert c.post("/auth/login", json={"username": "night_owl", "password": "correct horse"}).status_code == 429  # even the right one
    assert c.post("/auth/login", json={"username": "maya", "password": "sleepsquad"}).status_code == 200  # others unaffected
    auth_core._fails.clear()
    assert c.post("/auth/login", json={"username": "night_owl", "password": "correct horse"}).status_code == 200


def test_signup_rate_limit():
    codes = [signup(f"user_{i:02d}").status_code for i in range(11)]
    assert codes[:10] == [201] * 10 and codes[10] == 429


def test_friend_card_shows_avatar_and_bio():
    token = signup().json()["token"]
    uid = c.get("/auth/me", headers=bearer(token)).json()["id"]
    c.put("/me", json={"avatar": "🌙", "bio": "lights out at 11"}, headers=bearer(token))
    card = c.get(f"/users/{uid}/card", headers=bearer(make_token(1))).json()  # Maya looks at the new user
    assert card["avatar"] == "🌙" and card["bio"] == "lights out at 11" and card["name"] == "night_owl"
