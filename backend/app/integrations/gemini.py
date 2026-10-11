"""Gemini morning briefing (google-genai, structured JSON output).

Privacy: only this user's own numbers go in the prompt (no friends, no other Health data).
Gemini compares the user only to their own baseline and makes no medical claims.
Any failure (no key, network, bad JSON) falls back to a plain template, so the endpoint never breaks."""
import datetime as dt
import logging

from pydantic import BaseModel

from ..config import settings
from ..models import Overview
from ..scoring import BADGES

log = logging.getLogger(__name__)

MODELS = ("gemini-3.8-flash", "gemini-3.5-flash")  # second is a retry when the first is slow or overloaded
TIMEOUT_MS = 10_000  # per attempt (API minimum); Gemini sometimes stalls ~20 s before a 504
NOTE = "(Just a friendly sleep summary, not medical advice.)"

SYSTEM = """You write a short, upbeat morning sleep briefing for a college student in a sleep-competition app.
It is shown on screen and read aloud: plain sentences, numbers as digits, no emoji, no markdown, no lists.
Rules:
- Compare the user ONLY to their own recent nights. Never mention other people or population averages.
- No medical claims, diagnoses, or health conditions. Do not mention doctors, disorders, or supplements.
- Be warm and specific: use the actual numbers given. Never invent numbers.
- If last night was rough, be kind and encouraging, never guilt-tripping.
- headline: a greeting with their first name, under 10 words.
- body: 2 short sentences about last night vs their own recent nights (score, hours, bedtime, streak).
- tip: 1 short, practical, non-medical suggestion for tonight, tied to the weakest part of their score."""


class BriefingDraft(BaseModel):
    """Structured output requested from Gemini."""

    headline: str
    body: str
    tip: str


_client = None
_cache: dict[tuple, str] = {}  # (user_id, day, score, streak) -> text, so it's one Gemini call per night


def _clock(t: dt.datetime) -> str:
    return f"{t.hour % 12 or 12}:{t.minute:02d} {'AM' if t.hour < 12 else 'PM'}"


def _facts(o: Overview) -> str:
    """Plain-text facts about this user only, for the prompt."""
    n, s = o.last_night, o.score
    prior = [h.score for h in o.history[:-1]]
    lines = [
        f"First name: {o.user.name.split()[0]}",
        f"Last night: {n.duration_min / 60:.1f} h asleep, bed {_clock(n.bedtime)}, up {_clock(n.wake_time)}, "
        f"efficiency {n.efficiency:.0%}, deep {n.deep_min} min, REM {n.rem_min} min, awake {n.awake_min} min",
        f"Score: {s.score:.0f}/100 (duration {s.duration_pts:.0f}/40, bedtime consistency {s.consistency_pts:.0f}/30, "
        f"quality {s.quality_pts:.0f}/20, streak {s.streak_pts:.0f}/10)",
    ]
    if prior:
        avg = sum(prior) / len(prior)
        lines.append(f"Their own average score over the previous {len(prior)} nights: {avg:.0f} "
                     f"({s.score - avg:+.0f} today)")
    lines.append(f"Streak: {o.streak_days} nights" + (f", badge {o.badge}" if o.badge else ""))
    nxt = next(((need, name) for need, name in reversed(BADGES) if o.streak_days < need), None)
    if nxt:
        lines.append(f"Next badge: {nxt[1]} at {nxt[0]} nights ({nxt[0] - o.streak_days} to go)")
    return "\n".join(lines)


def _ask_gemini(facts: str) -> BriefingDraft:
    """Structured-output call, retried once on the backup model. Raises if both fail."""
    global _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    from google import genai
    from google.genai import types

    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key, http_options=types.HttpOptions(timeout=TIMEOUT_MS))
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM,
        response_mime_type="application/json",
        response_schema=BriefingDraft,
        temperature=0.8,
        thinking_config=types.ThinkingConfig(thinking_level="LOW"),  # ~2 s instead of ~7 s; MINIMAL unsupported
    )
    for i, model in enumerate(MODELS):
        try:
            resp = _client.models.generate_content(model=model, contents=facts, config=config)
            if isinstance(resp.parsed, BriefingDraft):
                return resp.parsed
            return BriefingDraft.model_validate_json(resp.text or "")
        except Exception as e:
            if i == len(MODELS) - 1:
                raise
            log.warning("Gemini %s failed, retrying with %s: %s", model, MODELS[i + 1], e)


def _sentence(s: str) -> str:
    s = s.strip()
    return s if s[-1] in ".!?" else s + "."


def _fallback(o: Overview) -> str:
    hours = o.last_night.duration_min / 60
    return (
        f"Good morning {o.user.name}! You slept {hours:.1f} hours and scored "
        f"{o.score.score:.0f}. Streak: {o.streak_days} nights. {NOTE}"
    )


def briefing_text(overview: Overview) -> str:
    """Morning briefing for one user: Gemini when available, template otherwise. Always ends with NOTE."""
    if overview.score is None or overview.last_night is None:
        return f"Good morning {overview.user.name}! Sync your sleep to get your first briefing. {NOTE}"
    key = (overview.user.id, overview.last_night.day, overview.score.score, overview.streak_days)
    if key in _cache:
        return _cache[key]
    try:
        d = _ask_gemini(_facts(overview))
    except Exception as e:  # never fail the endpoint over the AI call
        log.warning("Gemini briefing failed, using template: %s", e)
        return _fallback(overview)  # not cached, so the next request retries Gemini
    text = " ".join(_sentence(p) for p in (d.headline, d.body, d.tip) if p.strip()) + f" {NOTE}"
    _cache[key] = text
    return text
