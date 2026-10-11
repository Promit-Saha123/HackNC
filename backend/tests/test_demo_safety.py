from fastapi.testclient import TestClient

from app.main import app
from app.routes import sleep
from app.store import Store

c = TestClient(app)
NIGHT = "2026-10-09T23:40:00-04:00|2026-10-10T07:20:00-04:00|Core"


def test_health_default_is_cheap():
    assert c.get("/health").json() == {"status": "ok"}


def test_health_deep_in_memory_mode(monkeypatch):
    monkeypatch.setattr("app.main.settings.database_url", "")
    assert c.get("/health?deep=true").json() == {"status": "ok", "db": "memory"}


def test_health_deep_reports_database_down(monkeypatch):
    monkeypatch.setattr("app.main.settings.database_url", "postgres://nowhere")

    def boom():
        raise RuntimeError("database is down")

    monkeypatch.setattr("app.main.get_pool", boom)
    r = c.get("/health?deep=true")
    assert r.status_code == 503 and r.json() == {"status": "degraded", "db": "down"}
    assert c.get("/health").status_code == 200  # plain liveness doesn't depend on the database


def test_oversized_upload_is_rejected_but_normal_ones_pass(monkeypatch):
    monkeypatch.setattr(sleep, "store", Store())
    headers = {"X-User-Id": "1"}
    assert c.post("/sleep/shortcut", content=b"x" * (sleep.MAX_UPLOAD_BYTES + 1), headers=headers).status_code == 413
    assert c.post("/sleep/shortcut", content=NIGHT, headers=headers).json()["nights_found"] == 1


def test_upload_cap_also_counts_bytes_with_no_content_length(monkeypatch):
    monkeypatch.setattr(sleep, "store", Store())
    chunk = b"x" * 100_000
    streamed = (chunk for _ in range(sleep.MAX_UPLOAD_BYTES // len(chunk) + 1))  # chunked body, no Content-Length header
    assert c.post("/sleep/shortcut", content=streamed, headers={"X-User-Id": "1"}).status_code == 413
