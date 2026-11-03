from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import UUID, uuid4

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from estimator_api.db import EstimateRow
from estimator_api.errors import InvalidRequestError, NotFoundError
from estimator_api.features import FEATURE_NAMES
from estimator_api.ml_client import MlClient, ModelResponseError
from estimator_api.repository import EstimateRepository
from estimator_api.schemas import Comparison, Estimate, EstimateCreate, EstimatePage, Range


def to_estimate(row: EstimateRow) -> Estimate:
    return Estimate(
        id=UUID(row.id),
        label=row.label,
        features=row.features,
        predicted_price=row.predicted_price,
        model_version=row.model_version,
        warnings=row.warnings,
        contributions=row.contributions,
        created_at=row.created_at_utc,
    )


class EstimateService:
    def __init__(self, session: AsyncSession, ml: MlClient) -> None:
        self.session = session
        self.repository = EstimateRepository(session)
        self.ml = ml

    async def create(self, payload: EstimateCreate, request_id: str | None) -> Estimate:
        features = payload.features.model_dump()
        prediction = await self.ml.predict(features, request_id)
        now = datetime.now(UTC)
        try:
            estimate = Estimate(
                id=uuid4(),
                label=payload.label,
                features=features,
                predicted_price=prediction["predicted_price"],
                model_version=prediction["model_version"],
                warnings=prediction.get("warnings", []),
                contributions=prediction.get("contributions"),
                created_at=now,
            )
        except ValidationError as exc:
            raise ModelResponseError(
                "ml-api returned warnings or contributions in an unexpected shape"
            ) from exc
        await self.repository.add(
            EstimateRow(
                id=str(estimate.id),
                label=estimate.label,
                features=estimate.features,
                predicted_price=estimate.predicted_price,
                model_version=estimate.model_version,
                warnings=[w.model_dump() for w in estimate.warnings],
                contributions=estimate.contributions.model_dump() if estimate.contributions else None,
                created_at=now.replace(tzinfo=None),
            )
        )
        await self.session.commit()
        return estimate

    async def page(self, limit: int, offset: int) -> EstimatePage:
        rows, total = await self.repository.page(limit, offset)
        return EstimatePage(items=[to_estimate(r) for r in rows], total=total, limit=limit, offset=offset)

    async def get(self, estimate_id: UUID) -> Estimate:
        row = await self.repository.get(str(estimate_id))
        if row is None:
            raise NotFoundError(f"No estimate with id {estimate_id}")
        return to_estimate(row)

    async def compare(self, ids: Sequence[UUID]) -> Comparison:
        unique = list(dict.fromkeys(ids))
        if len(unique) < 2:
            raise InvalidRequestError("ids", "Give 2 to 4 different estimate ids")
        rows = await self.repository.get_many([str(i) for i in unique])
        if not rows:
            raise NotFoundError("None of the requested estimates exist")
        found = {UUID(r.id) for r in rows}
        estimates = [to_estimate(r) for r in rows]
        columns = {name: [e.features[name] for e in estimates] for name in FEATURE_NAMES}
        columns["predicted_price"] = [e.predicted_price for e in estimates]
        return Comparison(
            estimates=estimates,
            missing_ids=[i for i in unique if i not in found],
            ranges={name: Range(min=min(values), max=max(values)) for name, values in columns.items()},
        )

    async def delete(self, estimate_id: UUID) -> None:
        if not await self.repository.delete(str(estimate_id)):
            raise NotFoundError(f"No estimate with id {estimate_id}")
        await self.session.commit()

    async def delete_all(self) -> int:
        deleted = await self.repository.delete_all()
        await self.session.commit()
        return deleted
