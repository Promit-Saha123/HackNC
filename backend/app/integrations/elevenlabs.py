"""ElevenLabs text-to-speech: the morning briefing read aloud.

Generated only when someone taps Listen (GET /ai/briefing/{id}/audio), then cached on disk by a hash of
voice + model + text, so each briefing costs one ElevenLabs call. The API key stays in backend/.env."""
import hashlib
import re
from pathlib import Path

from ..config import settings


AUDIO_DIR = Path(__file__).resolve().parents[2] / "audio_cache"
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # premade "Sarah": mature, reassuring; override with ELEVENLABS_VOICE_ID
MODEL = "eleven_flash_v2_5"  # low latency, so tap-to-listen starts in a couple of seconds
VOICE = {"stability": 0.6, "similarity_boost": 0.75, "style": 0.15, "speed": 0.95, "use_speaker_boost": True}
TIMEOUT_S = 20

_client = None


def available() -> bool:
    return bool(settings.elevenlabs_api_key)


def spoken(text: str) -> str:
    """Text for the ear: drop the trailing '(... not medical advice.)' note, which stays on screen."""
    return re.sub(r"\s*\([^()]*not medical advice[^()]*\)\s*$", "", text).strip()


def audio_file(text: str) -> Path:
    """MP3 of `text`, generated once and cached. Raises if there is no key or ElevenLabs fails."""
    global _client
    voice = settings.elevenlabs_voice_id or DEFAULT_VOICE_ID
    path = AUDIO_DIR / (hashlib.sha256(f"{voice}|{MODEL}|{text}".encode()).hexdigest()[:20] + ".mp3")
    if path.is_file():
        return path
    if not available():
        raise RuntimeError("ELEVENLABS_API_KEY is not set")
    from elevenlabs import VoiceSettings
    from elevenlabs.client import ElevenLabs

    if _client is None:
        _client = ElevenLabs(api_key=settings.elevenlabs_api_key, timeout=TIMEOUT_S)
    def tts(voice_id: str) -> bytes:
        return b"".join(_client.text_to_speech.convert(
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
