from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import Role


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class StreamToken(BaseModel):
    token: str
    expires_in: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str | None
    role: Role
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str | None = None
    role: Role = Role.level_1


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None
    password: str | None = None


class Camera(BaseModel):
    """Minimal shape used by the camera viewer (any authenticated user)."""

    id: str
    name: str
    is_active: bool = True
    zone: str | None = None
    secured: bool = False


class CameraOut(BaseModel):
    """Full shape used by the camera management panel (super_admin only).
    Never includes the password — only whether credentials are set."""

    id: str
    name: str
    host: str
    port: int
    path: str
    username: str | None
    has_password: bool
    zone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CameraCreate(BaseModel):
    name: str
    host: str
    port: int = 554
    path: str = ""
    username: str | None = None
    password: str | None = None
    zone: str | None = None
    is_active: bool = True


class CameraUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    port: int | None = None
    path: str | None = None
    username: str | None = None
    password: str | None = None
    zone: str | None = None
    is_active: bool | None = None


class SnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    camera_id: str | None
    camera_name: str
    image_width: int | None
    image_height: int | None
    is_annotated: bool
    created_at: datetime


class SnapshotBatchRequest(BaseModel):
    camera_ids: list[str]


class SnapshotBatchResult(BaseModel):
    camera_id: str
    snapshot: SnapshotOut | None = None
    error: str | None = None


class InferenceDetection(BaseModel):
    label: str
    confidence: float
    x: float
    y: float
    width: float
    height: float


class InferenceResult(BaseModel):
    image: str
    detections: list[InferenceDetection]


class LabelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    color: str


class LabelCreate(BaseModel):
    name: str
    color: str = "#6366F1"


class AnnotationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    snapshot_id: str
    label_id: str
    x: float
    y: float
    width: float
    height: float


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    display_name: str
    is_unknown: bool


class DetectionEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    person_id: str
    person_name: str
    camera_id: str | None
    camera_name: str
    started_at: datetime
    ended_at: datetime
    detection_count: int
    max_confidence: float | None


class DetectionEventPage(BaseModel):
    items: list[DetectionEventOut]
    total: int


class AnnotationCreate(BaseModel):
    snapshot_id: str
    label_id: str
    x: float
    y: float
    width: float
    height: float


class DashboardStats(BaseModel):
    total_cameras: int
    active_cameras: int
    detections_today: int
    unknown_detections_today: int
    distinct_people_today: int


class SystemHealthItem(BaseModel):
    key: str
    status: str  # "online" | "degraded" | "offline"
    detail: str | None = None


class TopPerson(BaseModel):
    person_id: str
    display_name: str
    is_unknown: bool
    detection_count: int


class InferenceRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    detection_count: int
    created_at: datetime
