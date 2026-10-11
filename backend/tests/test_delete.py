from fastapi.testclient import TestClient

from app.main import app
from app.routes import sleep
from app.store import Store


def test_delete_my_data(monkeypatch):
    store = Store()
    store.users[1] = store.users[1].model_copy(update={"is_demo": False})  # pretend Maya is a real user
    monkeypatch.setattr(sleep, "store", store)
    c = TestClient(app)
    assert c.delete("/users/2/data").status_code == 403  # demo profile
    assert c.delete("/users/999/data").status_code == 404
    assert c.delete("/users/1/data").status_code == 204
    assert c.get("/users/1/overview").status_code == 404
    assert all(u["id"] != 1 for u in c.get("/users").json())
    assert c.delete("/users/1/data").status_code == 404  # already gone
