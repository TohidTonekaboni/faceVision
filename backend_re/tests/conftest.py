import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.deps import get_current_user
from app.main import app
from app.models import Role, User

# Tests run against a real Postgres database (not sqlite) because models use
# the Postgres-specific UUID column type. Point this at a throwaway database
# distinct from the dev DB — e.g. `facevision_test` on the same instance.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://facevision:facevision@localhost:5432/facevision_test"
)

test_engine = create_async_engine(TEST_DATABASE_URL)
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def admin_user():
    return User(id=str(uuid.uuid4()), username="test-admin", hashed_password="x", role=Role.super_admin)


@pytest.fixture
def regular_user():
    return User(id=str(uuid.uuid4()), username="test-user", hashed_password="x", role=Role.level_1)


@pytest_asyncio.fixture
async def client(db_session, admin_user):
    async def _override_get_db():
        yield db_session

    async def _override_get_current_user():
        return admin_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()
