from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient

from app.integrations import gemini, insight
from app.main import app
from app.models import SleepNight

START = date(2026, 9, 7)  # a Monday wake date


def night(day: date, bed_hour: float, asleep_min: int) -> SleepNight:
    bed = datetime.combine(day - timedelta(days=1), datetime.min.time()) + timedelta(hours=bed_hour)
    return SleepNight(day=day, bedtime=bed, wake_time=bed + timedelta(minutes=asleep_min + 20), duration_min=asleep_min,
                      efficiency=0.95, deep_min=60, rem_min=90, light_min=asleep_min - 150, awake_min=20, source="test")


def nights(n: int, rule) -> list[SleepNight]:
    return [night(START + timedelta(days=i), *rule(i, START + timedelta(days=i))) for i in range(n)]


def test_bedtime_pattern():
    # alternate 23:00 / 01:00 bedtimes; early nights get 60 min more sleep
    f = insight.find_pattern(nights(28, lambda i, d: (23, 480) if i % 2 else (25, 420)))
    assert f.kind == "bedtime" and "1 h more" in f.fallback


def test_weekend_drift_pattern():
    f = insight.find_pattern(nights(28, lambda i, d: (25.5, 450) if d.weekday() in (5, 6) else (23, 450)))
    assert f.kind == "weekend" and "2 h 30 min later" in f.fallback


def test_trend_pattern():
    f = insight.find_pattern(nights(14, lambda i, d: (23, 480 if i >= 7 else 420)))
    assert f.kind == "trend" and "1 h more" in f.fallback


def test_steady_when_no_pattern():
    f = insight.find_pattern(nights(14, lambda i, d: (23, 450)))
    assert f.kind == "steady" and "7.5 hours" in f.fallback


def test_too_few_nights():
    r = insight.weekly_insight(1, "Maya", nights(5, lambda i, d: (23, 450)))
    assert r.kind is None and r.nights_used == 5 and "Sync at least 10" in r.text


def test_gemini_phrasing_is_used_and_cached(monkeypatch):
    calls = []

    def fake(system, contents, schema):
        calls.append(contents)
        return schema(insight="Midnight is your magic number")

    monkeypatch.setattr(gemini, "structured", fake)
    data = nights(28, lambda i, d: (23, 480) if i % 2 else (25, 420))
    r = insight.weekly_insight(1, "Maya Lee", data)
    assert r.text == f"Midnight is your magic number. {gemini.NOTE}" and r.kind == "bedtime"
    insight.weekly_insight(1, "Maya Lee", data)
    assert len(calls) == 1 and calls[0].startswith("First name: Maya\nPattern: ")


def test_no_key_falls_back_to_template():
    r = insight.weekly_insight(1, "Maya", nights(28, lambda i, d: (23, 480) if i % 2 else (25, 420)))
    assert r.text.startswith("You sleep 1 h more") and r.text.endswith(gemini.NOTE)


def test_endpoint():
    c = TestClient(app)
    body = c.get("/ai/insight/2").json()
    assert body["user_id"] == 2 and body["nights_used"] == 28 and body["kind"] and body["text"].endswith(gemini.NOTE)
    assert c.get("/ai/insight/999").status_code == 404
