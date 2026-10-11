import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from ..auth import check_rate, record_fail, require_self
from ..integrations import elevenlabs, gemini, insight, somni
from ..models import Briefing, ChatReply, ChatRequest, Insight, Transcript
from ..store import store

router = APIRouter()
# Briefings and insights describe one user's nights in detail (hours, bedtimes), so they follow the same
# STRICT_PRIVACY rule as /users/{id}/overview and /history: only the signed-in user can read their own.
SELF_ONLY = [Depends(require_self)]
log = logging.getLogger(__name__)


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
    """Somni chatbot: answers questions about the user's own Somnia data only (see integrations/somni.py)."""
    if not body.messages or body.messages[-1].role != "user" or not body.messages[-1].text.strip():
        raise HTTPException(422, "send at least one message, ending with the user's question")
    key = f"somni:{user_id}"
    check_rate(key, 30, 300)  # 30 messages per 5 minutes per user: protects the Gemini quota
    record_fail(key)
    reply = somni.chat(user_id, body.messages)
    if reply is None:
        raise HTTPException(404, "unknown user")
    if body.speak and elevenlabs.available():
        try:  # generated now and served from disk, so playback works on any server worker
            reply.audio_url = f"/ai/audio/{elevenlabs.audio_file(elevenlabs.spoken(reply.reply)).name}"
        except Exception as e:  # the text reply still works without audio
            log.warning("ElevenLabs Somni audio failed: %s", e)
    return reply


MAX_VOICE_BYTES = 3 * 1024 * 1024  # ~3 min of the app's m4a; push-to-talk questions are a few seconds
MIN_VOICE_BYTES = 1000  # shorter than this is an accidental tap


def _audio_kind(audio: bytes) -> str:
    """Container from magic bytes, for clearer errors when speech-to-text hears nothing."""
    if audio[4:8] == b"ftyp":
        return "m4a"
    if audio[:4] == b"caff":
        return "caf"
    if audio[:4] == b"RIFF":
        return "wav"
    if audio[:3] == b"ID3" or audio[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    return "unknown format"


@router.post("/ai/transcribe/{user_id}", response_model=Transcript, dependencies=SELF_ONLY)
async def transcribe(user_id: int, request: Request):
    """Push-to-talk for Somni: raw audio body (m4a) -> ElevenLabs speech-to-text -> the question's text."""
    if not elevenlabs.available():
        raise HTTPException(503, "voice isn't set up on this server")
    key = f"voice:{user_id}"
    check_rate(key, 20, 300)  # 20 recordings per 5 minutes per user
    record_fail(key)
    audio = bytearray()
    async for chunk in request.stream():
        audio += chunk
        if len(audio) > MAX_VOICE_BYTES:
            raise HTTPException(413, "That recording is too long. Keep questions under a minute.")
    if len(audio) < MIN_VOICE_BYTES:
        raise HTTPException(422, "I didn't catch that. Hold the mic a little longer.")
    try:
        text = await run_in_threadpool(elevenlabs.transcribe, bytes(audio), request.headers.get("content-type", "audio/mp4"))
    except Exception as e:
        log.warning("ElevenLabs transcription failed: %s", e)
        raise HTTPException(503, "Voice is unavailable right now. Try typing instead.")
    if not text:
        kind = _audio_kind(bytes(audio))
        log.warning("Transcription empty: %d bytes, %s", len(audio), kind)
        raise HTTPException(
            422, f"I didn't catch that. Try again a little closer to the mic. (heard {len(audio) // 1024} KB of {kind} audio)"
        )
    return Transcript(text=text)


@router.get("/ai/audio/{file}")
def audio(file: str):
    path = elevenlabs.AUDIO_DIR / Path(file).name  # .name blocks path traversal
    if not path.is_file():
        raise HTTPException(404, "audio not found")
    return FileResponse(path, media_type="audio/mpeg")