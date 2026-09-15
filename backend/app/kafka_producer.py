"""Publishes detection events to Kafka. Loaded lazily on first use (same
lazy-singleton pattern as app/inference.py's model loading), started/stopped
explicitly from app.main's lifespan so buffered messages flush on shutdown.

Publishing never raises: a live camera stream must keep running even if
Kafka is briefly unreachable, so failures here are logged and swallowed
rather than propagated into the inference loop.
"""

import asyncio
import json
from datetime import datetime

from aiokafka import AIOKafkaProducer

from app.config import settings
from app.logger import get_logger

logger = get_logger(__name__)

_producer: AIOKafkaProducer | None = None
_producer_lock = asyncio.Lock()


async def _get_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        async with _producer_lock:
            if _producer is None:
                producer = AIOKafkaProducer(
                    bootstrap_servers=settings.kafka_bootstrap_servers,
                    request_timeout_ms=2000,
                )
                await producer.start()
                _producer = producer
                logger.info("Kafka producer started (bootstrap_servers=%r)", settings.kafka_bootstrap_servers)
    return _producer


async def start_producer() -> None:
    """Eagerly starts the producer (called from app startup) so the first
    real publish isn't the one paying connection-setup latency."""
    await _get_producer()


async def stop_producer() -> None:
    global _producer
    if _producer is not None:
        await _producer.stop()
        _producer = None
        logger.info("Kafka producer stopped")


async def publish_detection_event(
    *,
    camera_id: str,
    camera_name: str,
    label: str,
    is_unknown: bool,
    confidence: float,
    x: float,
    y: float,
    width: float,
    height: float,
    detected_at: datetime,
) -> None:
    payload = {
        "camera_id": camera_id,
        "camera_name": camera_name,
        "label": label,
        "is_unknown": is_unknown,
        "confidence": confidence,
        "detected_at": detected_at.isoformat(),
        "bbox": {"x": x, "y": y, "width": width, "height": height},
    }
    try:
        producer = await _get_producer()
        await producer.send_and_wait(
            settings.kafka_detections_topic,
            value=json.dumps(payload).encode("utf-8"),
            key=camera_id.encode("utf-8"),
        )
    except Exception:
        logger.warning("Could not publish detection event for camera_id=%r", camera_id, exc_info=True)
