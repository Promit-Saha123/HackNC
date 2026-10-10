"""Nightly sleep score = 40*D + 30*C + 20*Q + 10*S, each part 0-1.

D duration:    1.0 for 7-10 h (no bonus above 9 h); linear to 0 at 5 h; small taper above 10 h.
C consistency: 1.0 within 30 min of the 7-night average bedtime; 0 at 2 h off.
Q quality:     efficiency = asleep / in bed.
S streak:      min(streak_days / 14, 1).
Streak night = 7 h+ asleep and bedtime within 1 h of usual. Badge tiers 3/7/14/30 nights.
"""
from statistics import mean

from .models import ScoreBreakdown, SleepNight

BADGES = [(30, "aurora"), (14, "rainbow"), (7, "cloud"), (3, "moon")]


def duration_part(minutes: float) -> float:
    h = minutes / 60
    if h < 5:
        return 0.0
    if h < 7:
        return (h - 5) / 2
    if h <= 10:
        return 1.0
    return max(0.7, 1 - 0.1 * (h - 10))


def consistency_part(offset_min: float) -> float:
    off = abs(offset_min)
    if off <= 30:
        return 1.0
    if off >= 120:
        return 0.0
    return 1 - (off - 30) / 90


def quality_part(efficiency: float) -> float:
    return min(1.0, max(0.0, efficiency))


def streak_part(streak_days: int) -> float:
    return min(streak_days / 14, 1.0)


def is_streak_night(duration_min: float, offset_min: float) -> bool:
    return duration_min >= 7 * 60 and abs(offset_min) <= 60


def bedtime_minutes(bedtime) -> int:
    """Minutes since 18:00, so 23:30 and 00:30 sit close together (no midnight wrap)."""
    return (bedtime.hour * 60 + bedtime.minute - 18 * 60) % 1440


def score_night(duration_min: float, offset_min: float, efficiency: float, streak_days: int) -> ScoreBreakdown:
    d, c = 40 * duration_part(duration_min), 30 * consistency_part(offset_min)
    q, s = 20 * quality_part(efficiency), 10 * streak_part(streak_days)
    return ScoreBreakdown(
        score=round(d + c + q + s, 1),
        duration_pts=round(d, 1),
        consistency_pts=round(c, 1),
        quality_pts=round(q, 1),
        streak_pts=round(s, 1),
        streak_days=streak_days,
    )


def compute_scores(nights: list[SleepNight]) -> list[ScoreBreakdown]:
    """Score nights (sorted oldest first); usual bedtime = mean of the previous 7 nights."""
    out, streak = [], 0
    for i, n in enumerate(nights):
        bed = bedtime_minutes(n.bedtime)
        prior = [bedtime_minutes(p.bedtime) for p in nights[max(0, i - 7) : i]]
        offset = bed - mean(prior) if prior else 0
        streak = streak + 1 if is_streak_night(n.duration_min, offset) else 0
        out.append(score_night(n.duration_min, offset, n.efficiency, streak))
    return out


def badge_for(streak_days: int) -> str | None:
    return next((name for need, name in BADGES if streak_days >= need), None)