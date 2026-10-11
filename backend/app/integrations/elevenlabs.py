"""ElevenLabs: the voice and ears of Sleep Squad.

Text-to-speech reads the morning briefing and Somni's spoken replies aloud. MP3s are generated on demand and
cached on disk by a hash of voice + model + text, so each text costs one ElevenLabs call.
Speech-to-text (Scribe) turns a push-to-talk recording into the question sent to Somni.
The API key stays in backend/.env (on Render: the service's Environment tab)."""
import hashlib
import re
from pathlib import Path

from ..config import settings

AUDIO_DIR = Path(__file__).resolve().parents[2] / "audio_cache"
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # premade "Sarah": mature, reassuring; override with ELEVENLABS_VOICE_ID
MODEL = "eleven_flash_v2_5"  # low latency, so tap-to-listen starts in a couple of seconds
STT_MODEL = "scribe_v2"
VOICE = {"stability": 0.6, "similarity_boost": 0.75, "style": 0.15, "speed": 0.95, "use_speaker_boost": True}
TIMEOUT_S = 20

_client = None


def available() -> bool:
    return bool(settings.elevenlabs_api_key)


def _get_client():
    global _client
    if not available():
        raise RuntimeError("ELEVENLABS_API_KEY is not set")
    if _client is None:
        from elevenlabs.client import ElevenLabs

        _client = ElevenLabs(api_key=settings.elevenlabs_api_key, timeout=TIMEOUT_S)
    return _client


def spoken(text: str) -> str:
    """Text for the ear: drop the trailing '(... not medical advice.)' note, which stays on screen."""
    return re.sub(r"\s*\([^()]*not medical advice[^()]*\)\s*$", "", text).strip()


def transcribe(audio: bytes, content_type: str = "audio/mp4") -> str:
    """Speech-to-text for a short push-to-talk recording (m4a from the app). Raises on failure."""
    result = _get_client().speech_to_text.convert(
        model_id=STT_MODEL, file=("question.m4a", audio, content_type), language_code="en", tag_audio_events=False
    )
    return " ".join((result.text or "").split())


def audio_file(text: str) -> Path:
    """MP3 of `text`, generated once and cached. Raises if there is no key or ElevenLabs fails."""
    voice = settings.elevenlabs_voice_id or DEFAULT_VOICE_ID
    path = AUDIO_DIR / (hashlib.sha256(f"{voice}|{MODEL}|{text}".encode()).hexdigest()[:20] + ".mp3")
    if path.is_file():
        return path
    client = _get_client()
    from elevenlabs import VoiceSettings

    def tts(voice_id: str) -> bytes:
        return b"".join(client.text_to_speech.convert(
            voice_id=voice_id, text=text, model_id=MODEL, output_format="mp3_44100_64",
            voice_settings=VoiceSettings(**VOICE),
        ))

    try:
        mp3 = tts(voice)
    except Exception as e:
        # A mistyped voice ID, or a library voice the plan can't use via the API, shouldn't break audio.
        if voice == DEFAULT_VOICE_ID or not any(code in str(e) for code in ("voice_not_found", "paid_plan_required")):
            raise
        mp3 = tts(DEFAULT_VOICE_ID)
    AUDIO_DIR.mkdir(exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_bytes(mp3)
    tmp.replace(path)  # atomic, so a half-written file is never served
    return path
