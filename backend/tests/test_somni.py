from fastapi.testclient import TestClient

from app.auth import make_token
from app.config import settings
from app.integrations import gemini, somni
from app.main import app

c = TestClient(app)


def ask(uid: int, text: str, history=(), headers=None):
    msgs = [*history, {"role": "user", "text": text}]
    return c.post(f"/ai/chat/{uid}", json={"messages": msgs}, headers=headers or {})


def test_context_is_own_data_plus_score_level_friends():
    ctx = somni.build_context(3)  # Sam
    assert "First name: Sam" in ctx and "Last 7 nights" in ctx and "Goals: bed by" in ctx
    assert "leaderboard: rank" in ctx and "Squad standings" in ctx
    other_lines = [line for line in ctx.splitlines() if "Maya" in line]
    assert other_lines and all("bed " not in line and " h asleep" not in line for line in other_lines)  # no friend sleep details
    assert somni.build_context(999) is None


def test_reply_uses_gemini_draft_and_sends_data_and_history(monkeypatch):
    seen = {}

    def fake(system, contents, schema):
        seen.update(system=system, contents=contents)
        return schema(reply="  You scored 50, up 4 on your week.  ", suggestions=["Why so short?", "why so short?", "", "x" * 99, "4th"], in_scope=True)

    monkeypatch.setattr(gemini, "structured", fake)
    r = ask(3, "How did I do?", history=[{"role": "user", "text": "hi"}, {"role": "somni", "text": "Hey Sam!"}])
    assert r.status_code == 200
    body = r.json()
    assert body == {"reply": "You scored 50, up 4 on your week.", "suggestions": ["Why so short?", "x" * 60, "4th"], "in_scope": True}
    assert "DATA:" in seen["contents"] and "User: hi\nSomni: Hey Sam!\nUser: How did I do?\nSomni:" in seen["contents"]
    assert "only help with" in seen["system"] and "988" in seen["system"]


def test_off_topic_flag_passes_through(monkeypatch):
    monkeypatch.setattr(
        gemini, "structured",
        lambda s, c_, schema: schema(reply="I can only help with your sleep and Sleep Squad.", suggestions=[], in_scope=False),
    )
    body = ask(1, "Write my essay on WW2").json()
    assert body["in_scope"] is False and body["suggestions"] == somni.DEFAULT_SUGGESTIONS


def test_long_messages_and_history_are_trimmed(monkeypatch):
    seen = {}
    monkeypatch.setattr(gemini, "structured", lambda s, contents, schema: seen.update(c=contents) or schema(reply="ok", suggestions=[], in_scope=True))
    history = [{"role": "user" if i % 2 == 0 else "somni", "text": f"turn{i}"} for i in range(30)]
    ask(1, "y" * 2000, history=history)
    assert "turn17" not in seen["c"] and "turn19" in seen["c"] and "y" * 500 in seen["c"] and "y" * 501 not in seen["c"]


def test_gemini_failure_falls_back_to_snapshot():
    body = ask(3, "How did I do?").json()  # conftest blanks the Gemini key
    assert "trouble thinking" in body["reply"] and "5.1 hours" in body["reply"] and body["suggestions"]


def test_validation_rate_limit_and_unknown_user(monkeypatch):
    assert c.post("/ai/chat/1", json={"messages": []}).status_code == 422
    assert c.post("/ai/chat/1", json={"messages": [{"role": "somni", "text": "hi"}]}).status_code == 422
    assert ask(1, "   ").status_code == 422
    assert ask(999, "hi").status_code == 404
    monkeypatch.setattr(gemini, "structured", lambda *a: (_ for _ in ()).throw(RuntimeError("x")))
    codes = [ask(5, "hi").status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429


def test_strict_privacy_chat_is_self_only(monkeypatch):
    monkeypatch.setattr(settings, "strict_privacy", True)
    monkeypatch.setattr(gemini, "structured", lambda s, c_, schema: schema(reply="ok", suggestions=[], in_scope=True))
    assert ask(2, "hi").status_code == 403
    assert ask(2, "hi", headers={"Authorization": f"Bearer {make_token(1)}"}).status_code == 403
    assert ask(2, "hi", headers={"Authorization": f"Bearer {make_token(2)}"}).status_code == 200
