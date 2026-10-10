from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..integrations import gemini
from ..models import Briefing
from ..store import store

router = APIRouter()
AUDIO_DIR = Path(__file__).resolve().parents[2] / "audio_cache"


@router.get("/ai/briefing/{user_id}", response_model=Briefing)
def briefing(user_id: int):
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    return Briefing(user_id=user_id, text=gemini.briefing_text(overview), audio_url=None)  # audio_url: v2 (ElevenLabs)


@router.get("/ai/audio/{file}")
def audio(file: str):
    path = AUDIO_DIR / Path(file).name  # .name blocks path traversal
    if not path.is_file():
        raise HTTPException(404, "audio not found")
    return FileResponse(path, media_type="audio/mpeg")