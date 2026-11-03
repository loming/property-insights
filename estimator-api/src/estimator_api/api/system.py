from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text

from estimator_api.api.deps import RequestId, get_model_info
from estimator_api.api.problems import PROBLEMS
from estimator_api.ml_client import CachedModelInfo
from estimator_api.schemas import Health

router = APIRouter()


@router.get(
    "/api/v1/model-info",
    tags=["model"],
    summary="The Task 1 model's /model-info, cached",
    responses={k: PROBLEMS[k] for k in (502, 503)},
)
async def model_info(
    cache: Annotated[CachedModelInfo, Depends(get_model_info)], request_id: RequestId
) -> dict[str, Any]:
    """Passed through from ml-api and cached for 5 minutes, so the portal's form gets labels, units and
    ranges without a model round trip on every page load. Served stale while ml-api is down."""
    return await cache.get(request_id)


@router.get(
    "/health",
    tags=["health"],
    response_model=Health,
    summary="Own health plus the model service's",
    responses={503: {"model": Health, "description": "The database is unreachable"}},
)
async def health(request: Request, response: Response) -> Health:
    """200 while the database works, even if ml-api is down (`degraded`): history and comparison still
    work then, and restarting this container wouldn't bring the model back."""
    try:
        async with request.app.state.sessions() as session:
            await session.execute(text("SELECT 1"))
        database = "up"
    except Exception:
        database = "down"
        response.status_code = 503
    ml_api = "up" if await request.app.state.ml.is_up() else "down"
    status = "ok" if database == "up" and ml_api == "up" else "degraded"
    return Health(status=status, database=database, ml_api=ml_api)
