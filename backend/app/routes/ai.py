from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..integrations import gemini, insight
from ..models import Briefing, Insight
from ..store import store

router = APIRouter()
AUDIO_DIR = Path(__file__).resolve().parents[2] / "audio_cache"


@router.get("/ai/briefing/{user_id}", response_model=Briefing)
def briefing(user_id: int):
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    return Briefing(user_id=user_id, text=gemini.briefing_text(overview), audio_url=None)  # audio_url: v2 (ElevenLabs)


@router.get("/ai/insight/{user_id}", response_model=Insight)
def weekly_insight(user_id: int):
    """Strongest pattern in the user's last 28 nights, phrased by Gemini (numbers computed in code)."""
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    return insight.weekly_insight(user_id, overview.user.name, store.recent_nights(user_id, 28))


@router.get("/ai/audio/{file}")
def audio(file: str):
    path = AUDIO_DIR / Path(file).name  # .name blocks path traversal
    if not path.is_file():
        raise HTTPException(404, "audio not found")
    return FileResponse(path, media_type="audio/mpeg")