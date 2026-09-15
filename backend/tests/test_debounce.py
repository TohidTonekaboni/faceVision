from datetime import datetime, timedelta, timezone

from app.worker.events_consumer import should_extend

BASE = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def test_tick_within_threshold_extends():
    assert should_extend(BASE, BASE + timedelta(seconds=3), debounce_seconds=5.0) is True


def test_tick_exactly_at_threshold_extends():
    assert should_extend(BASE, BASE + timedelta(seconds=5), debounce_seconds=5.0) is True


def test_tick_past_threshold_does_not_extend():
    assert should_extend(BASE, BASE + timedelta(seconds=5, milliseconds=1), debounce_seconds=5.0) is False


def test_large_gap_does_not_extend():
    assert should_extend(BASE, BASE + timedelta(minutes=10), debounce_seconds=5.0) is False
