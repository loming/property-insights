from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, create_model

from ml_api.features import EXAMPLE_HOUSE, FEATURES, Feature

MAX_BATCH_SIZE = 1000


def _feature_field(feature: Feature) -> tuple[type, Any]:
    constraints: dict[str, Any] = {"ge": feature.hard_min, "le": feature.hard_max}
    if feature.integer:
        field_type: type = int
    else:
        field_type = float
        constraints["allow_inf_nan"] = False
        if feature.step:
            constraints["multiple_of"] = feature.step
    description = f"{feature.label} ({feature.unit})"
    return field_type, Field(description=description, **constraints)


# Built from FEATURES so validation can never drift from the feature metadata.
HouseFeatures = create_model(
    "HouseFeatures",
    __config__=ConfigDict(extra="forbid", json_schema_extra={"examples": [EXAMPLE_HOUSE]}),
    __doc__="One property. Every field is required; unknown fields are rejected.",
    **{f.name: _feature_field(f) for f in FEATURES},
)


class PredictionWarning(BaseModel):
    code: Literal["OUTSIDE_TRAINING_RANGE", "UNUSUAL_COMBINATION"]
    field: str | None = Field(None, description="The feature concerned; absent for UNUSUAL_COMBINATION")
    value: float | None = Field(None, description="The input value, or the leverage for UNUSUAL_COMBINATION")
    message: str


class Contributions(BaseModel):
    baseline: float = Field(description="Prediction for the average training home (the mean price)")
    by_feature: dict[str, float] = Field(
        description="Coefficient × (value − training mean) per feature; baseline + the sum = predicted_price"
    )


class PredictionResponse(BaseModel):
    predicted_price: float
    currency: Literal["USD"] = "USD"
    model_version: str
    warnings: list[PredictionWarning]
    contributions: Contributions | None = Field(None, description="Only with ?explain=true")


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[HouseFeatures] = Field(min_length=1, max_length=MAX_BATCH_SIZE)  # type: ignore[valid-type]


class BatchPrediction(BaseModel):
    index: int = Field(description="0-based position in `items`")
    predicted_price: float
    warnings: list[PredictionWarning]


class BatchResponse(BaseModel):
    count: int
    model_version: str
    predictions: list[BatchPrediction]


class Health(BaseModel):
    status: Literal["ok", "unavailable"]
    model_loaded: bool
    model_version: str | None


class MeanStd(BaseModel):
    mean: float
    std: float


class CvMetrics(BaseModel):
    r2: MeanStd
    rmse: MeanStd
    mae: MeanStd
    mape: MeanStd = Field(description="Mean absolute percentage error, as a fraction (0.03 = 3%)")


class PointMetrics(BaseModel):
    r2: float
    rmse: float
    mae: float
    mape: float


class Metrics(BaseModel):
    evaluation_method: str
    cv: CvMetrics
    in_sample: PointMetrics = Field(description="Fit on all training rows, scored on the same rows")
    holdout: PointMetrics = Field(description="80/20 split, seed 42; noisy with 50 rows, see cv")
    baseline_mean: CvMetrics = Field(description="Predict-the-mean baseline under the same CV")
    ols_comparison: CvMetrics | None = Field(None, description="Ridge only: plain OLS under the same CV")


class Coefficient(BaseModel):
    feature: str
    per_unit: float = Field(description="Price change for +1 unit, every other feature held constant")
    unit: str
    standardised: float | None = Field(None, description="Ridge only: price change for +1 standard deviation")


class FeatureInfo(BaseModel):
    name: str
    label: str
    unit: str
    training_min: float
    training_max: float
    mean: float
    allowed_min: float
    allowed_max: float
    step: float | None


class PriceDistribution(BaseModel):
    bin_edges: list[float]
    counts: list[int]


class AlphaCandidate(BaseModel):
    alpha: float
    cv_rmse: float
    passes_sign_gate: bool


class Selection(BaseModel):
    rule: str
    candidates: list[AlphaCandidate]
    chosen_alpha: float


class ModelInfo(BaseModel):
    model_type: Literal["linear_regression", "ridge"]
    model_version: str
    trained_at: str
    training_rows: int
    sklearn_version: str
    dataset_sha256: str
    intercept: float = Field(description="Prediction when every feature is 0; not meaningful on its own")
    baseline_at_mean: float = Field(description="Prediction for the average training home")
    coefficients: list[Coefficient]
    metrics: Metrics
    features: list[FeatureInfo]
    price_distribution: PriceDistribution
    leverage_threshold: float = Field(
        description="UNUSUAL_COMBINATION fires above this (the training maximum)"
    )
    selection: Selection | None = Field(None, description="Ridge only: how alpha was chosen")
    notes: list[str]
