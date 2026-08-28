from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.logger import get_logger
from app.models import Role, User
from app.security import decode_access_token, decode_media_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
logger = get_logger(__name__)


async def get_current_user(
    token_header: str | None = Depends(oauth2_scheme),
    token_query: str | None = Query(default=None, alias="token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Accepts the access token via the Authorization header, or a `token`
    query param for endpoints loaded as <img>/<video> src where custom
    headers can't be attached."""
    token = token_header or token_query
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    user_id = decode_access_token(token)
    if not user_id:
        logger.warning("Rejected request with invalid or expired access token")
        raise credentials_error

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        logger.warning("Rejected request for missing or inactive user_id=%r", user_id)
        raise credentials_error

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.super_admin:
        logger.warning("Forbidden admin access attempt by user %r", user.username)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


async def resolve_media_user(token: str | None, resource: str, db: AsyncSession) -> User:
    """For media endpoints (camera stream, snapshot image) loaded via <img> src.
    Accepts either a full access token, or a media token scoped to this exact
    resource (e.g. "camera:cam1") — the latter keeps long-lived access tokens
    out of URLs/logs. Used directly by route handlers rather than as a
    Depends(), since the resource string is derived from the path param."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    user_id = decode_access_token(token)
    if not user_id:
        media = decode_media_token(token)
        if not media or media[1] != resource:
            raise credentials_error
        user_id = media[0]

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_error

    return user
