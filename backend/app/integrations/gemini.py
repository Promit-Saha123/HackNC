from ..models import Overview

NOTE = "(Just a friendly sleep summary, not medical advice.)"


def briefing_text(overview: Overview) -> str:
    """STUB (v2, P2): replace with a google-genai call returning structured JSON.
    Must compare the user only to their own baseline and make no medical claims."""
    if overview.score is None or overview.last_night is None:
        return f"Good morning {overview.user.name}! Sync your sleep to get your first briefing. {NOTE}"
    hours = overview.last_night.duration_min / 60
    return (
        f"Good morning {overview.user.name}! You slept {hours:.1f} hours and scored "
        f"{overview.score.score:.0f}. Streak: {overview.streak_days} nights. {NOTE}"
    )