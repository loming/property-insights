from datetime import datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, create_model

from estimator_api.features import EXAMPLE_HOUSE, FEATURES, Feature


def _feature_field(feature: Feature) -> tuple[type, Any]:
    constraints: dict[str, Any] = {"ge": feature.hard_min, "le": feature.hard_max}
    if feature.integer:
        field_type: type = int
    else:
        field_type = float
        constraints["allow_inf_nan"] = False
        if feature.step:
            constraints["multiple_of"] = feature.step
    return field_type, Field(description=f"{feature.label} ({feature.unit})", **constraints)


HouseFeatures = create_model(
    "HouseFeatures",
    __config__=ConfigDict(extra="forbid", json_schema_extra={"examples": [EXAMPLE_HOUSE]}),
    __doc__="One property. Every field is required; unknown fields are rejected.",
    **{f.name: _feature_field(f) for f in FEATURES},
)

# Free text shown back to every visitor: trimmed, capped, single line.
Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80, pattern=r"^[^\r\n\t]*$")]


class EstimateCreate(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"examples": [{"label": "Flat on Elm St", "features": EXAMPLE_HOUSE}]},
    )

    label: Label | None = Field(None, description="Optional name shown in history, e.g. an address")
    features: HouseFeatures  # type: ignore[valid-type]


class PredictionWarning(BaseModel):
    code: str
    field: str | None = None
    value: float | None = None
    message: str


class Contributions(BaseModel):
    baseline: float
    by_feature: dict[str, float]


class Estimate(BaseModel):
    id: UUID
    label: str | None
    features: dict[str, float]
    predicted_price: float
    currency: Literal["USD"] = "USD"
    model_version: str
    warnings: list[PredictionWarning]
    contributions: Contributions | None
    created_at: datetime


class EstimatePage(BaseModel):
    items: list[Estimate]
    total: int
    limit: int
    offset: int


class Range(BaseModel):
    min: float
    max: float


class Comparison(BaseModel):
    estimates: list[Estimate] = Field(description="In the order the ids were given; missing ids are skipped")
    missing_ids: list[UUID] = Field(description="Requested ids that don't exist (deleted, or never did)")
    ranges: dict[str, Range] = Field(
        description="Min and max across the found estimates, per feature and for predicted_price, for highlighting"
    )


class Health(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down"]
    ml_api: Literal["up", "down"]
