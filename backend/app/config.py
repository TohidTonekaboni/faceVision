from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://facevision:facevision@db:5432/facevision"

    jwt_secret: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    media_token_expire_seconds: int = 300

    # Symmetric key used to encrypt stored camera passwords at rest. Override
    # in production — anyone with this value plus DB access can recover
    # camera credentials.
    camera_secret_key: str = "insecure-camera-secret-change-me"

    snapshot_dir: str = "/app/storage/snapshots"

    # RetinaFace (det_10g) + ArcFace (w600k_r50) from the InsightFace
    # "buffalo_l" model pack, downloaded/cached on first use.
    face_model_pack: str = "buffalo_l"
    face_ctx_id: int = -1  # -1 for CPU, >=0 for GPU device id
    face_det_thresh: float = 0.5
    face_identify_threshold: float = 0.35
    face_gallery_path: str = "/app/inference/gallery.npz"
    # CPU inference (RetinaFace + ArcFace per frame) is far slower than raw
    # MJPEG relay, so live inference runs at its own, lower frame rate rather
    # than the stream's ~15 FPS.
    face_inference_fps: float = 2.0
    # ONNX Runtime's default is to parallelize *each* session's ops across
    # every CPU core. That's fine for one session, but a live-inference
    # session per camera means several sessions running concurrently (via
    # the threadpool) each trying to claim every core at once — the
    # oversubscription slows every camera down, not just one. Pinning each
    # session to a small, fixed thread budget instead lets concurrency across
    # cameras (not within a single frame) do the parallelizing.
    face_onnx_intra_op_threads: int = 1
    face_onnx_inter_op_threads: int = 1
    max_offline_inference_upload_bytes: int = 10 * 1024 * 1024

    # Caps how many distinct cameras can have an active RTSP capture open at
    # once (not viewers — viewers of the same camera share one capture).
    # Guards against exhausting FFmpeg processes/RTSP sessions on the host.
    max_concurrent_camera_streams: int = 16

    admin_username: str = "admin"
    admin_password: str = "ChangeMe123!"
    admin_full_name: str = "Administrator"

    cors_origins: str = "http://localhost:5173"

    log_level: str = "INFO"

    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_detections_topic: str = "detections"
    kafka_consumer_group_id: str = "detection-events-consumer"
    # How long a gap (in seconds) between two ticks of the same person on the
    # same camera is tolerated before the presence interval is considered
    # closed and a new one starts. Keeps detection_events rows as "presence
    # bars" for reporting instead of one row per inference tick.
    detection_debounce_seconds: float = 5.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
