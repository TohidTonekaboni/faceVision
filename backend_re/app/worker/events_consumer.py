"""Consumes the `detections` Kafka topic and persists presence intervals to
Postgres. Runs as its own process (see docker-compose.yml's `worker`
service) rather than inside the FastAPI app, so restarting/redeploying the
API never causes a consumer-group rebalance or an ingestion gap.

Debounce/session-grouping: ticks for the same (person, camera) are folded
into one open `detection_events` row (extending `ended_at`) as long as they
keep arriving within `settings.detection_debounce_seconds` of each other.
Once a gap exceeds that threshold, the row is left closed and a new tick for
that pair starts a fresh row. Open-interval state is tracked in-memory in
this single consumer process (a single instance/consumer-group member is a
deliberate constraint — see docker-compose.yml comments), not in Postgres,
so a consumer restart starts fresh intervals rather than resuming exactly
where it left off. That's an accepted, documented limitation for this R&D
phase: the worst case is one presence interval getting cosmetically split
across a restart, not a correctness bug.
"""

import asyncio
import json
import signal
from dataclasses import dataclass
from datetime import datetime

from aiokafka import AIOKafkaConsumer
from sqlalchemy import case, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import SessionLocal
from app.logger import configure_logging, get_logger
from app.models import DetectionEvent, Person

logger = get_logger(__name__)

# Bounds how long an idle (person, camera) entry is kept in memory once its
# interval has closed — just housekeeping so long-running uptime can't grow
# this dict forever; it does not affect correctness (a stale entry evicted
# early just means the next tick for that pair starts a new row, same as if
# the gap had actually been exceeded).
_STALE_ENTRY_TTL_SECONDS = 3600.0


@dataclass
class _OpenInterval:
    event_id: str
    last_tick_at: datetime


def should_extend(last_tick_at: datetime, new_tick_at: datetime, debounce_seconds: float) -> bool:
    """Pure decision function, unit-tested independently of Kafka/DB: does a
    new tick belong to the still-open interval, or does the gap since the
    last tick mean a new interval should start? Inclusive of the boundary
    itself (a gap exactly equal to the threshold still extends)."""
    gap = (new_tick_at - last_tick_at).total_seconds()
    return gap <= debounce_seconds


class EventsConsumer:
    def __init__(self) -> None:
        self._open_intervals: dict[tuple[str, str], _OpenInterval] = {}
        self._person_id_cache: dict[str, str] = {}

    async def _get_or_create_person_id(self, db: AsyncSession, label: str, is_unknown: bool) -> str:
        cached = self._person_id_cache.get(label)
        if cached is not None:
            return cached

        person_id = await db.scalar(select(Person.id).where(Person.display_name == label))
        if person_id is None:
            stmt = (
                pg_insert(Person)
                .values(display_name=label, is_unknown=is_unknown)
                .on_conflict_do_nothing(index_elements=[Person.display_name])
            )
            await db.execute(stmt)
            person_id = await db.scalar(select(Person.id).where(Person.display_name == label))

        self._person_id_cache[label] = person_id
        return person_id

    def _evict_stale_intervals(self, now: datetime) -> None:
        stale_keys = [
            key
            for key, interval in self._open_intervals.items()
            if (now - interval.last_tick_at).total_seconds() > _STALE_ENTRY_TTL_SECONDS
        ]
        for key in stale_keys:
            del self._open_intervals[key]

    async def process_message(self, db: AsyncSession, payload: dict) -> None:
        camera_id: str = payload["camera_id"]
        camera_name: str = payload["camera_name"]
        label: str = payload["label"]
        is_unknown: bool = payload["is_unknown"]
        confidence: float = payload["confidence"]
        detected_at = datetime.fromisoformat(payload["detected_at"])

        person_id = await self._get_or_create_person_id(db, label, is_unknown)
        key = (person_id, camera_id)
        open_interval = self._open_intervals.get(key)

        if open_interval is not None and should_extend(open_interval.last_tick_at, detected_at, settings.detection_debounce_seconds):
            await db.execute(
                update(DetectionEvent)
                .where(DetectionEvent.id == open_interval.event_id)
                .values(
                    ended_at=detected_at,
                    detection_count=DetectionEvent.detection_count + 1,
                    max_confidence=_greatest(DetectionEvent.max_confidence, confidence),
                )
            )
            open_interval.last_tick_at = detected_at
        else:
            event = DetectionEvent(
                person_id=person_id,
                camera_id=camera_id,
                camera_name=camera_name,
                started_at=detected_at,
                ended_at=detected_at,
                detection_count=1,
                max_confidence=confidence,
            )
            db.add(event)
            await db.flush()
            self._open_intervals[key] = _OpenInterval(event_id=event.id, last_tick_at=detected_at)

        await db.commit()
        self._evict_stale_intervals(detected_at)


def _greatest(column, value: float):
    return case((column.is_(None), value), (column < value, value), else_=column)


async def run() -> None:
    configure_logging()
    consumer = AIOKafkaConsumer(
        settings.kafka_detections_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group_id,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    processor = EventsConsumer()

    await consumer.start()
    logger.info(
        "Events consumer started (topic=%r, group_id=%r)",
        settings.kafka_detections_topic,
        settings.kafka_consumer_group_id,
    )

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop_event.set)

    try:
        async for message in consumer:
            if stop_event.is_set():
                break
            try:
                payload = json.loads(message.value)
                async with SessionLocal() as db:
                    await processor.process_message(db, payload)
                await consumer.commit()
            except Exception:
                logger.exception("Failed to process detection event message; skipping offset commit")
    finally:
        await consumer.stop()
        logger.info("Events consumer stopped")


if __name__ == "__main__":
    asyncio.run(run())
