import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from ..auth import check_rate, record_fail, require_self
from ..integrations import elevenlabs, gemini, insight, somni
from ..models import Briefing, ChatReply, ChatRequest, Insight
from ..store import store

router = APIRouter()
# Briefings and insights describe one user's nights in detail (hours, bedtimes), so they follow the same
# STRICT_PRIVACY rule as /users/{id}/overview and /history: only the signed-in user can read their own.
SELF_ONLY = [Depends(require_self)]
log = logging.getLogger(__name__)
AUDIO_DIR = elevenlabs.AUDIO_DIR


@router.get("/ai/briefing/{user_id}", response_model=Briefing, dependencies=SELF_ONLY)
def briefing(user_id: int):
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    # Audio is generated lazily when the user taps Listen, so the briefing itself stays fast.
    audio_url = f"/ai/briefing/{user_id}/audio" if elevenlabs.available() and overview.last_night else None
    return Briefing(user_id=user_id, text=gemini.briefing_text(overview), audio_url=audio_url)


@router.get("/ai/briefing/{user_id}/audio", dependencies=SELF_ONLY)
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


@router.get("/ai/insight/{user_id}", response_model=Insight, dependencies=SELF_ONLY)
def weekly_insight(user_id: int):
    """Strongest pattern in the user's last 28 nights, phrased by Gemini (numbers computed in code)."""
    overview = store.overview(user_id)
    if overview is None:
        raise HTTPException(404, "unknown user")
    return insight.weekly_insight(user_id, overview.user.name, store.recent_nights(user_id, 28))


@router.post("/ai/chat/{user_id}", response_model=ChatReply, dependencies=SELF_ONLY)
def chat(user_id: int, body: ChatRequest):
    """Somni chatbot: answers questions about the user's own Sleep Squad data only (see integrations/somni.py)."""
    if not body.messages or body.messages[-1].role != "user" or not body.messages[-1].text.strip():
        raise HTTPException(422, "send at least one message, ending with the user's question")
    key = f"somni:{user_id}"
    check_rate(key, 30, 300)  # 30 messages per 5 minutes per user: protects the Gemini quota
    record_fail(key)
    reply = somni.chat(user_id, body.messages)
    if reply is None:
        raise HTTPException(404, "unknown user")
    return reply


@router.get("/ai/audio/{file}")
def audio(file: str):
    path = AUDIO_DIR / Path(file).name  # .name blocks path traversal
    if not path.is_file():
        raise HTTPException(404, "audio not found")
    return FileResponse(path, media_type="audio/mpeg")