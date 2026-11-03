from typing import Annotated

from fastapi import APIRouter, Depends

from ml_api.api.deps import get_model_store
from ml_api.api.problems import PROBLEM_RESPONSES
from ml_api.model_store import ModelStore
from ml_api.schemas import ModelInfo

router = APIRouter(tags=["model"])


@router.get(
    "/model-info",
    response_model=ModelInfo,
    response_model_exclude_none=True,
    summary="Coefficients, performance metrics and how to read them",
    responses={503: PROBLEM_RESPONSES[503]},
)
def model_info(store: Annotated[ModelStore, Depends(get_model_store)]) -> ModelInfo:
    """The served model: per-unit coefficients, cross-validated metrics against a predict-the-mean
    baseline, the training ranges behind the warnings, and `notes` on interpreting the coefficients."""
    return store.info
