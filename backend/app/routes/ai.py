import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..integrations import elevenlabs, gemini, insight
from ..models import Briefing, Insight
from ..store import store

router = APIRouter()
log = logging.getLogger(__name__)
AUDIO_DIR = elevenlabs.AUDIO_DIR


@router.get("/ai/briefing/{user_id}", response_model=Briefing)
def briefing(user_id: int):
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    # Audio is generated lazily when the user taps Listen, so the briefing itself stays fast.
    audio_url = f"/ai/briefing/{user_id}/audio" if elevenlabs.available() and overview.last_night else None
    return Briefing(user_id=user_id, text=gemini.briefing_text(overview), audio_url=audio_url)


@router.get("/ai/briefing/{user_id}/audio")
def briefing_audio(user_id: int):
    """The briefing read aloud by ElevenLabs (MP3, cached per briefing text)."""
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    try:
        path = elevenlabs.audio_file(elevenlabs.spoken(gemini.briefing_text(overview)))
    except Exception as e:
        log.warning("ElevenLabs briefing audio failed: %s", e)
        raise HTTPException(503, "audio unavailable right now")
    return FileResponse(path, media_type="audio/mpeg")


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