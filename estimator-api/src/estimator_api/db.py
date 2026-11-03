from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, String, event
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class EstimateRow(Base):
    __tablename__ = "estimates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    label: Mapped[str | None] = mapped_column(String(80))
    features: Mapped[dict[str, float]] = mapped_column(JSON)
    predicted_price: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(String(64))
    warnings: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    contributions: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    # Stored as UTC; SQLite keeps no time zone, so reads attach it again (see created_at_utc).
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)

    @property
    def created_at_utc(self) -> datetime:
        return self.created_at.replace(tzinfo=UTC)


def create_engine(database_url: str) -> AsyncEngine:
    engine = create_async_engine(database_url)
    if database_url.startswith("sqlite"):

        @event.listens_for(engine.sync_engine, "connect")
        def _sqlite_pragmas(dbapi_connection: Any, _: Any) -> None:
            cursor = dbapi_connection.cursor()
            # WAL lets reads proceed while a write is in progress.
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return engine


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker:
    return async_sessionmaker(engine, expire_on_commit=False)


async def create_schema(engine: AsyncEngine) -> None:
    """create_all on startup; Alembic migrations are the production next step."""
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
