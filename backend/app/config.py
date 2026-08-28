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

    inference_model_path: str = "/app/inference/best.pt"
    inference_confidence_threshold: float = 0.4

    # Caps how many distinct cameras can have an active RTSP capture open at
    # once (not viewers — viewers of the same camera share one capture).
    # Guards against exhausting FFmpeg processes/RTSP sessions on the host.
    max_concurrent_camera_streams: int = 16

    admin_username: str = "admin"
    admin_password: str = "ChangeMe123!"
    admin_full_name: str = "Administrator"

    cors_origins: str = "http://localhost:5173"

    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
