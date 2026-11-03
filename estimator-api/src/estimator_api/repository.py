from collections.abc import Sequence

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from estimator_api.db import EstimateRow


class EstimateRepository:
    """All SQL for estimates lives here; callers commit."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, row: EstimateRow) -> EstimateRow:
        self.session.add(row)
        await self.session.flush()
        return row

    async def get(self, estimate_id: str) -> EstimateRow | None:
        return await self.session.get(EstimateRow, estimate_id)

    async def page(self, limit: int, offset: int) -> tuple[Sequence[EstimateRow], int]:
        newest_first = select(EstimateRow).order_by(EstimateRow.created_at.desc(), EstimateRow.id.desc())
        rows = (await self.session.scalars(newest_first.limit(limit).offset(offset))).all()
        total = await self.session.scalar(select(func.count()).select_from(EstimateRow))
        return rows, total or 0

    async def get_many(self, estimate_ids: Sequence[str]) -> list[EstimateRow]:
        found = await self.session.scalars(select(EstimateRow).where(EstimateRow.id.in_(estimate_ids)))
        by_id = {row.id: row for row in found}
        return [by_id[i] for i in estimate_ids if i in by_id]

    async def delete(self, estimate_id: str) -> bool:
        result = await self.session.execute(delete(EstimateRow).where(EstimateRow.id == estimate_id))
        return result.rowcount > 0

    async def delete_all(self) -> int:
        result = await self.session.execute(delete(EstimateRow))
        return result.rowcount
