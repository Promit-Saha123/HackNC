from fastapi.testclient import TestClient

from app.config import settings
from app.integrations import elevenlabs, gemini
from app.main import app

c = TestClient(app)


class FakeTTS:
    def __init__(self):
        self.calls = []

    def convert(self, voice_id, text, **kwargs):
        self.calls.append(text)
        return iter([b"ID3", b"fake-mp3"])


def use_fake_client(monkeypatch) -> FakeTTS:
    tts = FakeTTS()
    monkeypatch.setattr(settings, "elevenlabs_api_key", "test")
    monkeypatch.setattr(elevenlabs, "_client", type("C", (), {"text_to_speech": tts})())
    return tts


def test_spoken_drops_medical_note_only():
    assert elevenlabs.spoken(f"Morning Maya! You scored 97. {gemini.NOTE}") == "Morning Maya! You scored 97."
    assert elevenlabs.spoken("Bed by 11 (your usual time).") == "Bed by 11 (your usual time)."


def test_no_key_means_no_audio_url():
    assert c.get("/ai/briefing/1").json()["audio_url"] is None
    assert c.get("/ai/briefing/1/audio").status_code == 503


def test_audio_generated_once_and_cached(monkeypatch):
    tts = use_fake_client(monkeypatch)
    assert c.get("/ai/briefing/1").json()["audio_url"] == "/ai/briefing/1/audio"
    for _ in range(2):
        r = c.get("/ai/briefing/1/audio")
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg" and r.content == b"ID3fake-mp3"
    assert len(tts.calls) == 1 and "not medical advice" not in tts.calls[0]
    assert not list(elevenlabs.AUDIO_DIR.glob("*.part"))


def test_elevenlabs_failure_is_503(monkeypatch):
    tts = use_fake_client(monkeypatch)
    tts.convert = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("quota"))
    assert c.get("/ai/briefing/1/audio").status_code == 503
    assert c.get("/ai/briefing/999/audio").status_code == 404


def test_unknown_voice_falls_back_to_default(monkeypatch):
    tts = use_fake_client(monkeypatch)
    monkeypatch.setattr(settings, "elevenlabs_voice_id", "not-a-voice")
    voices = []

    def convert(voice_id, text, **kwargs):
        voices.append(voice_id)
        if voice_id == "not-a-voice":
            raise RuntimeError("status 400 voice_not_found")
        return iter([b"ok"])

    tts.convert = convert
    assert c.get("/ai/briefing/1/audio").content == b"ok"
    assert voices == ["not-a-voice", elevenlabs.DEFAULT_VOICE_ID]


def test_paid_only_voice_falls_back_but_other_errors_raise(monkeypatch):
    tts = use_fake_client(monkeypatch)
    monkeypatch.setattr(settings, "elevenlabs_voice_id", "library-voice")
    tts.convert = lambda voice_id, text, **k: (
        iter([b"ok"]) if voice_id == elevenlabs.DEFAULT_VOICE_ID else (_ for _ in ()).throw(RuntimeError("402 paid_plan_required"))
    )
    assert c.get("/ai/briefing/1/audio").content == b"ok"
    tts.convert = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("401 invalid_api_key"))
    assert c.get("/ai/briefing/2/audio").status_code == 503  # not a voice problem: no silent fallback
