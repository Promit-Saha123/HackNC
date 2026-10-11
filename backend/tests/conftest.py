import pytest

from app.config import settings
from app.integrations import gemini, insight


@pytest.fixture(autouse=True)
def no_live_gemini(monkeypatch):
    """Tests never call the real Gemini API, even when backend/.env has a key."""
    monkeypatch.setattr(settings, "gemini_api_key", "")
    gemini._cache.clear()
    insight._cache.clear()
