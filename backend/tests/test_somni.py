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
    assert body == {
        "reply": "You scored 50, up 4 on your week.", "suggestions": ["Why so short?", "x" * 60, "4th"],
        "in_scope": True, "audio_url": None,  # no audio unless the app asks (speak=true)
    }
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


class FakeVoice:
    def __init__(self, text="How do I catch Chris this week?"):
        self.heard, self.said, self.text = [], [], text
        self.speech_to_text = self
        self.text_to_speech = type("TTS", (), {"convert": lambda _s, voice_id, text, **k: self.said.append(text) or iter([b"mp3"])})()

    def convert(self, model_id, file, **kwargs):  # speech_to_text.convert
        self.heard.append(file)
        return type("R", (), {"text": self.text})()


def use_fake_voice(monkeypatch, **kw) -> FakeVoice:
    from app.integrations import elevenlabs

    fake = FakeVoice(**kw)
    monkeypatch.setattr(settings, "elevenlabs_api_key", "test")
    monkeypatch.setattr(elevenlabs, "_client", fake)
    return fake


def test_transcribe_push_to_talk(monkeypatch):
    fake = use_fake_voice(monkeypatch, text="  How do I   catch Chris this week? ")
    r = c.post("/ai/transcribe/3", content=bytes(5000), headers={"Content-Type": "audio/mp4"})
    assert r.status_code == 200 and r.json() == {"text": "How do I catch Chris this week?"}
    assert fake.heard[0][0] == "question.m4a" and len(fake.heard[0][1]) == 5000


def test_transcribe_rejects_bad_audio(monkeypatch):
    use_fake_voice(monkeypatch, text="")
    assert c.post("/ai/transcribe/4", content=bytes(10)).status_code == 422  # accidental tap
    assert c.post("/ai/transcribe/4", content=bytes(5000)).status_code == 422  # nothing heard
    assert c.post("/ai/transcribe/4", content=bytes(3 * 1024 * 1024 + 1)).status_code == 413


def test_transcribe_needs_elevenlabs():
    assert c.post("/ai/transcribe/1", content=bytes(5000)).status_code == 503  # conftest blanks the key


def test_speak_returns_spoken_reply_audio(monkeypatch):
    fake = use_fake_voice(monkeypatch)
    monkeypatch.setattr(gemini, "structured", lambda s, c_, schema: schema(reply="Sleep by 11 tonight.", suggestions=[], in_scope=True))
    msgs = [{"role": "user", "text": "How do I catch Chris?"}]
    body = c.post("/ai/chat/6", json={"messages": msgs, "speak": True}).json()
    assert body["audio_url"].startswith("/ai/audio/") and fake.said == ["Sleep by 11 tonight."]
    audio = c.get(body["audio_url"])
    assert audio.status_code == 200 and audio.content == b"mp3"
    assert c.post("/ai/chat/6", json={"messages": msgs}).json()["audio_url"] is None  # typed chat: no audio
