from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.logger import get_logger
from app.models import RefreshToken, User
from app.schemas import RefreshRequest, Token, UserOut
from app.security import (
    create_access_token,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)


async def _issue_tokens(user: User, db: AsyncSession) -> Token:
    raw_refresh_token, token_hash, expires_at = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    await db.commit()
    return Token(access_token=create_access_token(user.id), refresh_token=raw_refresh_token)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.username == form_data.username))
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login attempt for username %r", form_data.username)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        logger.warning("Login attempt for disabled account %r", user.username)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    logger.info("User %r logged in", user.username)
    return await _issue_tokens(user, db)


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if not stored or stored.revoked_at is not None:
        logger.warning("Refresh attempt with unknown or revoked token")
        raise invalid
    if stored.expires_at < datetime.now(timezone.utc):
        logger.warning("Refresh attempt with expired token for user_id=%r", stored.user_id)
        raise invalid

    user = await db.get(User, stored.user_id)
    if not user or not user.is_active:
        raise invalid

    # Rotate: revoke the used refresh token so it can't be replayed.
    stored.revoked_at = datetime.now(timezone.utc)
    await db.commit()

    return await _issue_tokens(user, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = hash_refresh_token(payload.refresh_token)
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        await db.commit()


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
