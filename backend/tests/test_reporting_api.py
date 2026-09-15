from datetime import datetime, timedelta, timezone

import pytest

from app.deps import get_current_user
from app.main import app
from app.models import Camera, DetectionEvent, Person

pytestmark = pytest.mark.asyncio


async def _seed(db_session):
    known = Person(display_name="Alice", is_unknown=False)
    unknown = Person(display_name="unknown", is_unknown=True)
    camera = Camera(name="Lobby", host="10.0.0.5")
    db_session.add_all([known, unknown, camera])
    await db_session.flush()

    now = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
    db_session.add_all(
        [
            DetectionEvent(
                person_id=known.id,
                camera_id=camera.id,
                camera_name=camera.name,
                started_at=now,
                ended_at=now + timedelta(minutes=5),
                detection_count=10,
                max_confidence=0.9,
            ),
            DetectionEvent(
                person_id=unknown.id,
                camera_id=camera.id,
                camera_name=camera.name,
                started_at=now + timedelta(hours=1),
                ended_at=now + timedelta(hours=1, minutes=1),
                detection_count=2,
                max_confidence=0.4,
            ),
        ]
    )
    await db_session.flush()
    return known, unknown, camera


async def test_list_events_excludes_unknown_by_default(client, db_session):
    known, unknown, camera = await _seed(db_session)

    response = await client.get(
        "/api/reporting/events", params={"date_from": "2026-01-01", "date_to": "2026-01-01"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["person_name"] == "Alice"


async def test_list_events_include_unknown(client, db_session):
    await _seed(db_session)

    response = await client.get(
        "/api/reporting/events",
        params={"date_from": "2026-01-01", "date_to": "2026-01-01", "include_unknown": True},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 2


async def test_person_timeline_filters_by_person_and_day(client, db_session):
    known, _unknown, _camera = await _seed(db_session)

    response = await client.get(
        f"/api/reporting/people/{known.id}/timeline",
        params={"date": "2026-01-01", "tz_offset_minutes": 0},
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["person_name"] == "Alice"


async def test_reporting_requires_admin(client, db_session, regular_user):
    await _seed(db_session)

    async def _override_non_admin():
        return regular_user

    app.dependency_overrides[get_current_user] = _override_non_admin
    response = await client.get(
        "/api/reporting/events", params={"date_from": "2026-01-01", "date_to": "2026-01-01"}
    )

    assert response.status_code == 403
