from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query

from ml_api.api.deps import get_model_store
from ml_api.api.problems import PROBLEM_RESPONSES
from ml_api.errors import OutsideModelDomainError
from ml_api.features import EXAMPLE_BATCH, EXAMPLE_HOUSE
from ml_api.model_store import ModelStore
from ml_api.schemas import BatchPrediction, BatchRequest, BatchResponse, HouseFeatures, PredictionResponse

router = APIRouter(tags=["predict"])
Store = Annotated[ModelStore, Depends(get_model_store)]

SINGLE_EXAMPLES = {
    "typical": {"summary": "A typical home (test-CSV row 1)", "value": EXAMPLE_HOUSE},
    "extrapolating": {
        "summary": "Outside the training range (test-CSV row 6): returns warnings",
        "value": EXAMPLE_BATCH[5],
    },
    "unusual": {
        "summary": "In range field by field, but an unusual combination: returns a warning",
        "value": {**EXAMPLE_HOUSE, "square_footage": 2150},
    },
    "too_big": {
        "summary": "A 4,100 sq ft median home: linear regression prices it at ≤ $0 (422); Ridge warns",
        "value": {
            "square_footage": 4100,
            "bedrooms": 3,
            "bathrooms": 2,
            "year_built": 1997,
            "lot_size": 7025,
            "distance_to_city_center": 4.05,
            "school_rating": 7.65,
        },
    },
}


# Plain `def`: scikit-learn inference is CPU-bound, so FastAPI runs it in its threadpool (doc 02, C3).
@router.post(
    "/predict",
    response_model=PredictionResponse,
    response_model_exclude_none=True,
    summary="Predict the price of one property",
    responses={k: PROBLEM_RESPONSES[k] for k in (413, 422, 503)},
)
def predict(
    house: Annotated[HouseFeatures, Body(openapi_examples=SINGLE_EXAMPLES)],  # type: ignore[valid-type]
    store: Store,
    explain: Annotated[
        bool, Query(description="Add each feature's contribution relative to the average home")
    ] = False,
) -> PredictionResponse:
    row = house.model_dump()
    price = float(store.predict([row])[0])
    if price <= 0:
        raise OutsideModelDomainError([0])
    return PredictionResponse(
        predicted_price=round(price, 2),
        model_version=store.version,
        warnings=store.warnings([row])[0],
        contributions=store.contributions(row) if explain else None,
    )


@router.post(
    "/predict/batch",
    response_model=BatchResponse,
    summary="Predict the prices of 1-1,000 properties",
    responses={k: PROBLEM_RESPONSES[k] for k in (413, 422, 503)},
)
def predict_batch(
    body: Annotated[
        BatchRequest,
        Body(openapi_examples={"test_csv": {"summary": "The 10 rows of the provided test file",
                                            "value": {"items": EXAMPLE_BATCH}}}),
    ],
    store: Store,
) -> BatchResponse:
    """Predictions come back in input order, each with its 0-based `index`. If any price would be at
    or below $0, the whole batch is rejected with the offending `indices`."""
    rows = [item.model_dump() for item in body.items]
    prices = store.predict(rows)
    bad = [i for i, price in enumerate(prices) if price <= 0]
    if bad:
        raise OutsideModelDomainError(bad)
    warnings = store.warnings(rows)
    return BatchResponse(
        count=len(rows),
        model_version=store.version,
        predictions=[
            BatchPrediction(index=i, predicted_price=round(float(price), 2), warnings=warnings[i])
            for i, price in enumerate(prices)
        ],
    )
