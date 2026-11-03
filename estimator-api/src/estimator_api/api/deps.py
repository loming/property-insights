from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from estimator_api.ml_client import CachedModelInfo, MlClient
from estimator_api.observability import request_id_var
from estimator_api.services import EstimateService


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    # Uncommitted work is rolled back when the session closes, e.g. after a failed model call.
    async with request.app.state.sessions() as session:
        yield session


def get_ml_client(request: Request) -> MlClient:
    return request.app.state.ml


def get_model_info(request: Request) -> CachedModelInfo:
    return request.app.state.model_info


def get_service(
    session: Annotated[AsyncSession, Depends(get_session)], ml: Annotated[MlClient, Depends(get_ml_client)]
) -> EstimateService:
    return EstimateService(session, ml)


def get_request_id() -> str | None:
    return request_id_var.get()


Service = Annotated[EstimateService, Depends(get_service)]
RequestId = Annotated[str | None, Depends(get_request_id)]
