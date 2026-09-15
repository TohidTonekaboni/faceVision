import csv
import io
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin
from app.models import DetectionEvent, Person
from app.schemas import DetectionEventOut, DetectionEventPage, PersonOut

router = APIRouter(prefix="/api/reporting", tags=["reporting"], dependencies=[Depends(require_admin)])

# Hard cap on rows returned by a single CSV export, so an unbounded filter
# (e.g. no date range narrowing) can't produce an unbounded response.
MAX_EXPORT_ROWS = 50_000


def _date_range_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """A detection_events row overlaps [date_from, date_to] (inclusive) if it
    started before the range ends and ended on/after the range starts."""
    range_start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    range_end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
    return range_start, range_end


def _base_query(
    date_from: date,
    date_to: date,
    person_ids: list[str] | None,
    camera_ids: list[str] | None,
    include_unknown: bool,
) -> Select:
    range_start, range_end = _date_range_bounds(date_from, date_to)

    query = (
        select(
            DetectionEvent.id,
            DetectionEvent.person_id,
            Person.display_name.label("person_name"),
            DetectionEvent.camera_id,
            DetectionEvent.camera_name,
            DetectionEvent.started_at,
            DetectionEvent.ended_at,
            DetectionEvent.detection_count,
            DetectionEvent.max_confidence,
        )
        .join(Person, DetectionEvent.person_id == Person.id)
        .where(DetectionEvent.started_at < range_end, DetectionEvent.ended_at >= range_start)
    )

    if person_ids:
        query = query.where(DetectionEvent.person_id.in_(person_ids))
    if camera_ids:
        query = query.where(DetectionEvent.camera_id.in_(camera_ids))
    if not include_unknown:
        query = query.where(Person.is_unknown.is_(False))

    return query


@router.get("/people", response_model=list[PersonOut])
async def list_people(db: AsyncSession = Depends(get_db)):
    return (await db.scalars(select(Person).order_by(Person.display_name))).all()


@router.get("/events", response_model=DetectionEventPage)
async def list_events(
    date_from: date = Query(...),
    date_to: date = Query(...),
    person_ids: list[str] | None = Query(default=None),
    camera_ids: list[str] | None = Query(default=None),
    include_unknown: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = _base_query(date_from, date_to, person_ids, camera_ids, include_unknown)

    total = await db.scalar(select(func.count()).select_from(query.subquery()))

    page_query = query.order_by(DetectionEvent.started_at.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(page_query)).all()

    return DetectionEventPage(
        items=[DetectionEventOut.model_validate(row._mapping) for row in rows],
        total=total or 0,
    )


@router.get("/people/{person_id}/timeline", response_model=list[DetectionEventOut])
async def person_timeline(
    person_id: str,
    date_: date = Query(..., alias="date"),
    tz_offset_minutes: int = Query(default=0),
    db: AsyncSession = Depends(get_db),
):
    """Returns every presence interval for this person within the 24h window
    that corresponds to `date` in the caller's local time zone. `tz_offset_minutes`
    follows JS's Date.getTimezoneOffset() convention (minutes to ADD to local
    time to reach UTC), so day boundaries line up with what the browser's
    locale-aware date picker shows — no calendar-system (Jalali/Gregorian)
    logic is involved here, only a plain UTC-offset shift."""
    day_start_utc = datetime.combine(date_, time.min, tzinfo=timezone.utc) + timedelta(minutes=tz_offset_minutes)
    day_end_utc = day_start_utc + timedelta(days=1)

    query = (
        select(
            DetectionEvent.id,
            DetectionEvent.person_id,
            Person.display_name.label("person_name"),
            DetectionEvent.camera_id,
            DetectionEvent.camera_name,
            DetectionEvent.started_at,
            DetectionEvent.ended_at,
            DetectionEvent.detection_count,
            DetectionEvent.max_confidence,
        )
        .join(Person, DetectionEvent.person_id == Person.id)
        .where(
            DetectionEvent.person_id == person_id,
            DetectionEvent.started_at < day_end_utc,
            DetectionEvent.ended_at >= day_start_utc,
        )
        .order_by(DetectionEvent.started_at)
    )
    rows = (await db.execute(query)).all()
    return [DetectionEventOut.model_validate(row._mapping) for row in rows]


@router.get("/events/export.csv")
async def export_events_csv(
    date_from: date = Query(...),
    date_to: date = Query(...),
    person_ids: list[str] | None = Query(default=None),
    camera_ids: list[str] | None = Query(default=None),
    include_unknown: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    query = _base_query(date_from, date_to, person_ids, camera_ids, include_unknown)
    query = query.order_by(DetectionEvent.started_at.desc()).limit(MAX_EXPORT_ROWS)
    rows = (await db.execute(query)).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["person_name", "camera_name", "started_at", "ended_at", "duration_seconds", "detection_count", "max_confidence"])
    for row in rows:
        duration_seconds = (row.ended_at - row.started_at).total_seconds()
        writer.writerow(
            [
                row.person_name,
                row.camera_name,
                row.started_at.isoformat(),
                row.ended_at.isoformat(),
                f"{duration_seconds:.0f}",
                row.detection_count,
                row.max_confidence,
            ]
        )
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=detection_events.csv"},
    )
