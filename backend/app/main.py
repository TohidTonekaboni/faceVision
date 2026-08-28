import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.camera_stream import camera_stream_hub
from app.config import settings
from app.database import SessionLocal
from app.logger import configure_logging, get_logger
from app.models import Role, User
from app.routers import annotations, auth, camera_admin, cameras, labels, snapshots, users
from app.security import hash_password

configure_logging()
logger = get_logger(__name__)


async def _bootstrap_admin() -> None:
    async with SessionLocal() as db:
        has_any_user = await db.scalar(select(User).limit(1))
        if has_any_user:
            return
        admin = User(
            username=settings.admin_username,
            full_name=settings.admin_full_name,
            hashed_password=hash_password(settings.admin_password),
            role=Role.super_admin,
        )
        db.add(admin)
        await db.commit()
        logger.info("Bootstrapped admin user %r", admin.username)


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.makedirs(settings.snapshot_dir, exist_ok=True)
    # Schema is managed by Alembic migrations (run via the container entrypoint).
    await _bootstrap_admin()
    logger.info("FaceVision API startup complete")
    yield
    camera_stream_hub.stop_all()


app = FastAPI(title="FaceVision API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cameras.router)
app.include_router(camera_admin.router)
app.include_router(snapshots.router)
app.include_router(users.router)
app.include_router(labels.router)
app.include_router(annotations.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
