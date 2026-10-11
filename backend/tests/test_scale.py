from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import make_token
from app.main import app
from app.models import Prefs
from app.routes import auth, leaderboard, me, sleep
from app.store import Store

c = TestClient(app)


@pytest.fixture
def mem(monkeypatch):
    s = Store()
    for module in (sleep, me, leaderboard, auth):
        monkeypatch.setattr(module, "store", s)
    return s


def monday():
    return date.today() - timedelta(days=date.today().weekday())


def test_leaderboard_limit(mem):
    assert [e["rank"] for e in c.get("/leaderboard?period=all&limit=3").json()["entries"]] == [1, 2, 3]
    assert len(c.get("/leaderboard?period=all").json()["entries"]) == 8  # default window covers the demo squad
    assert c.get("/leaderboard?limit=0").status_code == 422
    assert c.get("/leaderboard?limit=501").status_code == 422


def test_users_paging_and_demo_filter(mem):
    assert len(c.get("/users?limit=3").json()) == 3
    assert [u["id"] for u in c.get("/users?limit=3&offset=6").json()] == [7, 8]
    mem.users[1] = mem.users[1].model_copy(update={"is_demo": False})  # a real account is never listed to strangers
    assert 1 not in [u["id"] for u in c.get("/users").json()]
    assert 1 in [u.id for u in mem.list_users()]  # internal callers can still see everyone


def test_get_user_and_deleted_account_token(mem):
    assert mem.get_user(1).name == "Maya" and mem.get_user(999) is None
    assert c.get("/auth/me", headers={"Authorization": f"Bearer {make_token(1)}"}).json()["name"] == "Maya"
    mem.delete_user(1)
    assert c.get("/auth/me", headers={"Authorization": f"Bearer {make_token(1)}"}).status_code == 401  # token outlives the user


def test_improved_only_improvers_and_respects_hide(mem):
    entries = mem.improved(monday(), None)
    assert entries and all(e.delta > 0 for e in entries)
    assert [e.delta for e in entries] == sorted((e.delta for e in entries), reverse=True)
    mem.set_prefs(entries[0].user_id, Prefs(show_on_board=False))
    assert entries[0].user_id not in [e.user_id for e in mem.improved(monday(), None)]
    assert all(e.squad == "Night Owls" for e in mem.improved(monday(), "night owls"))


def test_squad_board_and_members(mem):
    board = mem.squad_board("all")
    assert [e.rank for e in board] == list(range(1, len(board) + 1))
    assert [e.score for e in board] == sorted((e.score for e in board), reverse=True)
    assert {e.squad: e.members for e in board} == {"Wolfpack": 3, "Night Owls": 3, "Library Rats": 2}
    assert [m.name for m in mem.squad_members("wolfpack")] == ["Maya", "Jordan", "Sam"]
    assert mem.squad_members("wolfpack")[0].streak_days > 0
