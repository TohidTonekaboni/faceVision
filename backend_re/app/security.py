import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.logger import get_logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = get_logger(__name__)


@lru_cache
def _camera_fernet() -> Fernet:
    key = hashlib.sha256(settings.camera_secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_camera_password(password: str) -> str:
    return _camera_fernet().encrypt(password.encode()).decode()


def decrypt_camera_password(token: str) -> str:
    try:
        return _camera_fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        # CAMERA_SECRET_KEY changed since this was encrypted — fail safe
        # rather than opening a stream with garbage credentials.
        logger.error("Could not decrypt stored camera credentials — CAMERA_SECRET_KEY may have changed")
        raise ValueError("Could not decrypt stored camera credentials")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "type": "access", "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != "access":
        return None
    return payload.get("sub")


def create_media_token(subject: str, resource: str) -> str:
    """Short-lived, single-resource token for <img>/<video> src URLs, so the
    long-lived access token never has to be embedded in a query string
    (browser history, proxy logs, Referer headers)."""
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.media_token_expire_seconds)
    payload = {"sub": subject, "type": "media", "resource": resource, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_media_token(token: str) -> tuple[str, str] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
    if payload.get("type") != "media":
        return None
    sub = payload.get("sub")
    resource = payload.get("resource")
    if not sub or not resource:
        return None
    return sub, resource


def new_refresh_token() -> tuple[str, str, datetime]:
    """Returns (raw_token, token_hash, expires_at). Only the hash is persisted;
    the raw token is handed to the client and can't be recovered from the DB."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    return raw_token, token_hash, expires_at


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()
