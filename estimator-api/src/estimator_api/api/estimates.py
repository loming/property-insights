from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Body, Query, Request, Response
from pydantic import BaseModel

from estimator_api.api.deps import RequestId, Service
from estimator_api.api.problems import PROBLEMS
from estimator_api.features import EXAMPLE_HOUSE
from estimator_api.schemas import Comparison, Estimate, EstimateCreate, EstimatePage

router = APIRouter(prefix="/api/v1/estimates", tags=["estimates"])

CREATE_EXAMPLES = {
    "typical": {"summary": "A typical home", "value": {"label": "Flat on Elm St", "features": EXAMPLE_HOUSE}},
    "extrapolating": {
        "summary": "Newer than any training home: saved with warnings",
        "value": {"label": "New build", "features": {**EXAMPLE_HOUSE, "year_built": 2020}},
    },
    "too_big": {
        "summary": "4,100 sq ft: the brief set's model can't price it (422)",
        "value": {"label": None, "features": {**EXAMPLE_HOUSE, "square_footage": 4100, "lot_size": 7025}},
    },
}


class Deleted(BaseModel):
    deleted: int


@router.post(
    "",
    status_code=201,
    response_model=Estimate,
    summary="Estimate a property's price and save it to the history",
    responses={k: PROBLEMS[k] for k in (413, 422, 502, 503)},
)
async def create_estimate(
    payload: Annotated[EstimateCreate, Body(openapi_examples=CREATE_EXAMPLES)],
    service: Service,
    request_id: RequestId,
    request: Request,
    response: Response,
) -> Estimate:
    """Validates the input, asks the Task 1 model for a price with per-feature contributions, and saves
    the result. Nothing is saved if the model call fails."""
    estimate = await service.create(payload, request_id)
    response.headers["Location"] = str(request.url_for("get_estimate", estimate_id=estimate.id))
    return estimate


@router.get("", response_model=EstimatePage, summary="The history, newest first")
async def list_estimates(
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EstimatePage:
    return await service.page(limit, offset)


# Declared before /{estimate_id}, or that route would capture "compare" and fail UUID validation.
@router.get(
    "/compare",
    response_model=Comparison,
    summary="Compare 2-4 saved estimates side by side",
    responses={k: PROBLEMS[k] for k in (404, 422)},
)
async def compare_estimates(
    service: Service,
    ids: Annotated[
        list[UUID], Query(min_length=2, max_length=4, description="Repeat the parameter: ?ids=a&ids=b")
    ],
) -> Comparison:
    """Returns the estimates found, in the order given, with `missing_ids` for any that no longer exist,
    and each feature's min and max across them so a UI can highlight the differences."""
    return await service.compare(ids)


@router.get(
    "/{estimate_id}",
    name="get_estimate",
    response_model=Estimate,
    summary="One saved estimate",
    responses={404: PROBLEMS[404]},
)
async def get_estimate(estimate_id: UUID, service: Service) -> Estimate:
    return await service.get(estimate_id)


@router.delete(
    "/{estimate_id}", status_code=204, summary="Delete one estimate", responses={404: PROBLEMS[404]}
)
async def delete_estimate(estimate_id: UUID, service: Service) -> Response:
    await service.delete(estimate_id)
    return Response(status_code=204)


@router.delete("", response_model=Deleted, summary="Clear the whole history")
async def delete_all_estimates(service: Service) -> Deleted:
    return Deleted(deleted=await service.delete_all())
