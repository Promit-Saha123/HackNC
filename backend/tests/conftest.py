import pytest

from app.config import settings
from app.integrations import elevenlabs, gemini, insight


@pytest.fixture(autouse=True)
def no_live_gemini(monkeypatch, tmp_path):
    """Tests never call the real Gemini or ElevenLabs APIs, even when backend/.env has keys."""
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "elevenlabs_api_key", "")
    monkeypatch.setattr(elevenlabs, "AUDIO_DIR", tmp_path / "audio_cache")
    gemini._cache.clear()
    insight._cache.clear()
