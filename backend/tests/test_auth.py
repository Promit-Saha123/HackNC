from fastapi.testclient import TestClient

from app.auth import hash_password, make_token, user_id_from
from app.main import app
from app.store import store

c = TestClient(app)


def test_demo_login_and_me():
    name = store.list_users()[0].name
    r = c.post("/auth/login", json={"username": name.upper(), "password": "sleepsquad"})
    assert r.status_code == 200
    tok = r.json()["token"]
    assert c.get("/auth/me", headers={"Authorization": f"Bearer {tok}"}).json()["name"] == name


def test_bad_password_and_token():
    name = store.list_users()[0].name
    assert c.post("/auth/login", json={"username": name, "password": "nope"}).status_code == 401
    assert c.post("/auth/login", json={"username": "ghost", "password": "sleepsquad"}).status_code == 401
    assert c.get("/auth/me").status_code == 401
    assert c.get("/auth/me", headers={"Authorization": "Bearer junk"}).status_code == 401
    assert user_id_from(make_token(5) + "x") is None


def test_hashed_password_replaces_demo_password(monkeypatch):
    u = store.list_users()[0]
    monkeypatch.setattr(type(store), "login_info", lambda self, n: (u, hash_password("hunter2")))
    assert c.post("/auth/login", json={"username": u.name, "password": "hunter2"}).status_code == 200
    assert c.post("/auth/login", json={"username": u.name, "password": "sleepsquad"}).status_code == 401
