import asyncio
from datetime import datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Camera, DetectionEvent, Person
from app.schemas import DashboardStats, DetectionEventOut, SystemHealthItem, TopPerson

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])


def _today_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime.combine(now.date(), time.min, tzinfo=timezone.utc)


async def _camera_counts(db: AsyncSession) -> tuple[int, int]:
    total_cameras = await db.scalar(select(func.count()).select_from(Camera)) or 0
    active_cameras = await db.scalar(select(func.count()).select_from(Camera).where(Camera.is_active.is_(True))) or 0
    return total_cameras, active_cameras


@router.get("/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    today_start = _today_start_utc()

    total_cameras, active_cameras = await _camera_counts(db)

    detections_today = (
        await db.scalar(
            select(func.count())
            .select_from(DetectionEvent)
            .where(DetectionEvent.started_at >= today_start)
        )
        or 0
    )

    unknown_detections_today = (
        await db.scalar(
            select(func.count())
            .select_from(DetectionEvent)
            .join(Person, DetectionEvent.person_id == Person.id)
            .where(DetectionEvent.started_at >= today_start, Person.is_unknown.is_(True))
        )
        or 0
    )

    distinct_people_today = (
        await db.scalar(
            select(func.count(func.distinct(DetectionEvent.person_id)))
            .select_from(DetectionEvent)
            .join(Person, DetectionEvent.person_id == Person.id)
            .where(DetectionEvent.started_at >= today_start, Person.is_unknown.is_(False))
        )
        or 0
    )

    return DashboardStats(
        total_cameras=total_cameras,
        active_cameras=active_cameras,
        detections_today=detections_today,
        unknown_detections_today=unknown_detections_today,
        distinct_people_today=distinct_people_today,
    )


@router.get("/system-health", response_model=list[SystemHealthItem])
async def get_system_health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(select(1))
        database_status = "online"
    except Exception:
        database_status = "offline"

    total_cameras, active_cameras = await _camera_counts(db)
    if total_cameras > 0 and active_cameras == total_cameras:
        cameras_status = "online"
    elif active_cameras > 0 and active_cameras < total_cameras:
        cameras_status = "degraded"
    else:
        cameras_status = "offline"

    try:
        from app.kafka_producer import _get_producer

        await asyncio.wait_for(_get_producer(), timeout=2)
        kafka_status = "online"
    except asyncio.TimeoutError:
        kafka_status = "degraded"
    except Exception:
        kafka_status = "offline"

    return [
        SystemHealthItem(key="database", status=database_status),
        SystemHealthItem(key="cameras", status=cameras_status, detail=f"{active_cameras}/{total_cameras} active"),
        SystemHealthItem(key="kafka", status=kafka_status),
    ]


@router.get("/top-people", response_model=list[TopPerson])
async def get_top_people(
    days: int = Query(default=7),
    limit: int = Query(default=5, le=50),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = (
        select(
            Person.id.label("person_id"),
            Person.display_name,
            Person.is_unknown,
            func.count().label("detection_count"),
        )
        .join(DetectionEvent, DetectionEvent.person_id == Person.id)
        .where(DetectionEvent.started_at >= since, Person.is_unknown.is_(False))
        .group_by(Person.id, Person.display_name, Person.is_unknown)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [TopPerson.model_validate(row._mapping) for row in rows]


@router.get("/notifications", response_model=list[DetectionEventOut])
async def get_notifications(limit: int = Query(default=10), db: AsyncSession = Depends(get_db)):
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
        .order_by(DetectionEvent.started_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    return [DetectionEventOut.model_validate(row._mapping) for row in rows]
