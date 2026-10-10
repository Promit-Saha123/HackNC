from datetime import datetime

from app.scoring import (badge_for, bedtime_minutes, consistency_part, duration_part,
                         is_streak_night, quality_part, score_night)


def test_duration_part():
    assert duration_part(8 * 60) == 1.0
    assert duration_part(6 * 60) == 0.5
    assert duration_part(5 * 60) == 0.0
    assert duration_part(4 * 60) == 0.0
    assert duration_part(12 * 60) == 0.8


def test_consistency_part():
    assert consistency_part(-20) == 1.0
    assert consistency_part(120) == 0.0
    assert consistency_part(75) == 0.5


def test_perfect_night_scores_100():
    assert score_night(8 * 60, 0, 1.0, 14).score == 100


def test_streak_night_and_badges():
    assert is_streak_night(7 * 60, 60) and not is_streak_night(6.9 * 60, 0) and not is_streak_night(8 * 60, 61)
    assert [badge_for(n) for n in (0, 3, 7, 14, 30)] == [None, "moon", "cloud", "rainbow", "aurora"]


def test_bedtime_minutes_wraps_past_midnight():
    assert bedtime_minutes(datetime(2026, 1, 1, 23, 30)) == 330
    assert bedtime_minutes(datetime(2026, 1, 2, 0, 30)) == 390