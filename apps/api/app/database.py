from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db_rls import apply_rls_context
from app.db_url import sanitize_db_url

settings = get_settings()

def _async_url(url: str) -> str:
    url = sanitize_db_url(url)
    url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(
    _async_url(settings.database_url),
    echo=settings.environment == "development",
    pool_size=20,
    max_overflow=10,
    connect_args={"statement_cache_size": 0},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            await apply_rls_context(session)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
