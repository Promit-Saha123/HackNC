from app.store import Store


def test_history_has_times_and_duration():
    o = Store().overview(1)
    assert len(o.history) == 7
    assert all(h.duration_min and h.bedtime and h.wake_time for h in o.history)
    assert o.history[-1].duration_min == o.last_night.duration_min
