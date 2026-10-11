"""Weekly AI insight: find the user's strongest sleep pattern in code, let Gemini phrase it.

The numbers are computed here from the user's own last 28 nights, so Gemini can't invent stats;
it only turns one finding into a friendly sentence. Any Gemini failure falls back to a template."""
import logging
from dataclasses import dataclass
from statistics import mean, pstdev

from pydantic import BaseModel

from ..models import Insight, SleepNight
from ..scoring import bedtime_minutes
from . import gemini

log = logging.getLogger(__name__)

MIN_NIGHTS = 10
MIDNIGHT = 6 * 60  # bedtime_minutes() counts from 18:00, so midnight = 360

SYSTEM = """You write a one-line weekly sleep insight for a college student in a sleep-competition app.
You get ONE pattern that was already computed from the student's own nights. Rules:
- State the pattern using exactly the numbers given, as digits. Never invent or change numbers.
- Add one short, practical, non-medical suggestion that follows from it.
- Compare the student only to themselves. No medical claims, no mention of doctors or disorders.
- Warm and specific, 2 sentences max, plain text, no emoji, no markdown."""


class InsightDraft(BaseModel):
    insight: str


@dataclass
class Finding:
    kind: str
    strength: float  # effect / threshold; the strongest finding wins
    facts: str  # for the Gemini prompt
    fallback: str  # template text if Gemini is unavailable


_cache: dict[tuple, str] = {}


def _hm(minutes: float) -> str:
    m = round(abs(minutes))
    return f"{m} min" if m < 60 else f"{m // 60} h {m % 60} min" if m % 60 else f"{m // 60} h"


def _bedtime_finding(nights: list[SleepNight]) -> Finding | None:
    early = [n.duration_min for n in nights if bedtime_minutes(n.bedtime) <= MIDNIGHT]
    late = [n.duration_min for n in nights if bedtime_minutes(n.bedtime) > MIDNIGHT]
    if len(early) < 3 or len(late) < 3:
        return None
    diff = mean(early) - mean(late)
    if diff < 20:
        return None
    return Finding(
        "bedtime", diff / 20,
        f"On the {len(early)} of {len(nights)} nights they were in bed by midnight, they slept {_hm(diff)} more "
        f"than on nights they went to bed after midnight.",
        f"You sleep {_hm(diff)} more on nights you're in bed by midnight ({len(early)} of your last "
        f"{len(nights)} nights). Try making midnight your cutoff tonight.",
    )


def _weekend_finding(nights: list[SleepNight]) -> Finding | None:
    weekend = [bedtime_minutes(n.bedtime) for n in nights if n.day.weekday() in (5, 6)]  # Fri/Sat nights
    weekday = [bedtime_minutes(n.bedtime) for n in nights if n.day.weekday() not in (5, 6)]
    if len(weekend) < 2 or len(weekday) < 3:
        return None
    diff = mean(weekend) - mean(weekday)
    if diff < 45:
        return None
    return Finding(
        "weekend", diff / 45,
        f"On Friday and Saturday nights they go to bed {_hm(diff)} later than on weeknights.",
        f"On weekends you go to bed {_hm(diff)} later than on weeknights, which costs you consistency points. "
        f"Try keeping Friday within an hour of your usual bedtime.",
    )


def _trend_finding(nights: list[SleepNight]) -> Finding | None:
    if len(nights) < 14:
        return None
    this_week, last_week = mean(n.duration_min for n in nights[-7:]), mean(n.duration_min for n in nights[-14:-7])
    diff = this_week - last_week
    if abs(diff) < 20:
        return None
    more = diff > 0
    return Finding(
        "trend", abs(diff) / 20,
        f"Over the last 7 nights they slept {_hm(diff)} {'more' if more else 'less'} per night than the 7 nights "
        f"before.",
        f"You slept {_hm(diff)} {'more' if more else 'less'} per night this week than last week. "
        + ("Keep that rhythm going!" if more else "An earlier night or two could win it back."),
    )


def _steady_finding(nights: list[SleepNight]) -> Finding:
    spread = pstdev(bedtime_minutes(n.bedtime) for n in nights)
    hours = mean(n.duration_min for n in nights) / 60
    return Finding(
        "steady", 0,
        f"Across {len(nights)} nights they averaged {hours:.1f} hours asleep and their bedtime typically varied "
        f"by about {_hm(spread)}.",
        f"You've averaged {hours:.1f} hours a night over your last {len(nights)} nights, and your bedtime "
        f"usually stays within about {_hm(spread)}. Steady wins streaks!",
    )


def find_pattern(nights: list[SleepNight]) -> Finding:
    """Strongest of: bedtime-before-midnight effect, weekend drift, week-over-week trend; else 'steady'."""
    found = [f for f in (_bedtime_finding(nights), _weekend_finding(nights), _trend_finding(nights)) if f]
    return max(found, key=lambda f: f.strength) if found else _steady_finding(nights)


def weekly_insight(user_id: int, name: str, nights: list[SleepNight]) -> Insight:
    """Weekly insight for one user from their own recent nights (oldest first). Always ends with gemini.NOTE."""
    if len(nights) < MIN_NIGHTS:
        return Insight(
            user_id=user_id, nights_used=len(nights),
            text=f"Sync at least {MIN_NIGHTS} nights to unlock your weekly insight "
                 f"({len(nights)} so far). {gemini.NOTE}",
        )
    f = find_pattern(nights)
    key = (user_id, nights[-1].day, len(nights), f.kind)
    if key not in _cache:
        try:
            draft = gemini.structured(SYSTEM, f"First name: {name.split()[0]}\nPattern: {f.facts}", InsightDraft)
            _cache[key] = f"{gemini._sentence(draft.insight)} {gemini.NOTE}"
        except Exception as e:  # never fail the endpoint over the AI call
            log.warning("Gemini insight failed, using template: %s", e)
            return Insight(user_id=user_id, text=f"{f.fallback} {gemini.NOTE}", kind=f.kind, nights_used=len(nights))
    return Insight(user_id=user_id, text=_cache[key], kind=f.kind, nights_used=len(nights))
