"""Train the served model; runs during `docker build`.

    python -m ml_api.training.train --data ../data/house_prices.csv --out artifacts --kind ols

`ols` is the brief set's plain linear regression. `ridge` picks alpha by cross-validation among
the candidates whose size and quality coefficients are all positive (the sign gate).
"""

import argparse
import hashlib
import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import RegressorMixin, clone
from sklearn.dummy import DummyRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import (
    mean_absolute_error,
    mean_absolute_percentage_error,
    r2_score,
    root_mean_squared_error,
)
from sklearn.model_selection import RepeatedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from ml_api.features import FEATURE_NAMES, FEATURES, TARGET
from ml_api.schemas import (
    AlphaCandidate,
    Coefficient,
    CvMetrics,
    FeatureInfo,
    MeanStd,
    Metrics,
    ModelInfo,
    PointMetrics,
    PriceDistribution,
    Selection,
)

ModelKind = Literal["ols", "ridge"]
log = logging.getLogger(__name__)

CV = RepeatedKFold(n_splits=5, n_repeats=20, random_state=42)
ALPHAS = (0.1, 0.3, 1.0, 2.0, 3.0, 5.0, 10.0, 30.0, 100.0)
# Distance is a location feature, not a size or quality one, so the gate doesn't constrain its sign.
SIGN_GATE_EXEMPT = {"distance_to_city_center"}
MODEL_FILE = "model.joblib"
INFO_FILE = "metadata.json"


class DatasetError(ValueError):
    pass


class TrainingError(RuntimeError):
    pass


def load_dataset(path: Path) -> tuple[pd.DataFrame, pd.Series]:
    """Read the CSV and fail fast on anything unexpected; `id` is dropped, never a feature."""
    df = pd.read_csv(path)
    missing = [c for c in [*FEATURE_NAMES, TARGET] if c not in df.columns]
    if missing:
        raise DatasetError(f"{path}: missing columns {missing}")
    data = df[[*FEATURE_NAMES, TARGET]]
    non_numeric = [c for c in data.columns if not pd.api.types.is_numeric_dtype(data[c])]
    if non_numeric:
        raise DatasetError(f"{path}: non-numeric columns {non_numeric}")
    if data.isna().any().any():
        raise DatasetError(f"{path}: null values in {data.columns[data.isna().any()].tolist()}")
    if len(data) < 10:
        raise DatasetError(f"{path}: only {len(data)} rows")
    return data[FEATURE_NAMES].astype(float), data[TARGET].astype(float)


def _cv_metrics(estimator: RegressorMixin, X: pd.DataFrame, y: pd.Series) -> CvMetrics:
    scores = cross_validate(
        estimator,
        X,
        y,
        cv=CV,
        scoring={
            "r2": "r2",
            "rmse": "neg_root_mean_squared_error",
            "mae": "neg_mean_absolute_error",
            "mape": "neg_mean_absolute_percentage_error",
        },
    )

    def summary(key: str, sign: float) -> MeanStd:
        values = sign * scores[f"test_{key}"]
        return MeanStd(mean=float(values.mean()), std=float(values.std()))

    return CvMetrics(
        r2=summary("r2", 1), rmse=summary("rmse", -1), mae=summary("mae", -1), mape=summary("mape", -1)
    )


def _point_metrics(y_true: pd.Series, y_pred: np.ndarray) -> PointMetrics:
    return PointMetrics(
        r2=float(r2_score(y_true, y_pred)),
        rmse=float(root_mean_squared_error(y_true, y_pred)),
        mae=float(mean_absolute_error(y_true, y_pred)),
        mape=float(mean_absolute_percentage_error(y_true, y_pred)),
    )


def _ridge(alpha: float) -> Pipeline:
    return make_pipeline(StandardScaler(), Ridge(alpha=alpha))


def _per_unit(estimator: RegressorMixin) -> tuple[np.ndarray, float, np.ndarray | None]:
    """Per-unit coefficients, intercept, and (Ridge only) per-standard-deviation coefficients."""
    if isinstance(estimator, Pipeline):
        scaler, ridge = estimator[0], estimator[-1]
        per_unit = ridge.coef_ / scaler.scale_
        return per_unit, float(ridge.intercept_ - per_unit @ scaler.mean_), ridge.coef_
    return estimator.coef_, float(estimator.intercept_), None


def _passes_sign_gate(estimator: RegressorMixin) -> bool:
    per_unit, _, _ = _per_unit(estimator)
    return all(c > 0 for name, c in zip(FEATURE_NAMES, per_unit, strict=True) if name not in SIGN_GATE_EXEMPT)


def _select_ridge(X: pd.DataFrame, y: pd.Series) -> tuple[Pipeline, Selection]:
    candidates = []
    for alpha in ALPHAS:
        rmse = _cv_metrics(_ridge(alpha), X, y).rmse.mean
        passes = _passes_sign_gate(_ridge(alpha).fit(X, y))
        candidates.append(AlphaCandidate(alpha=alpha, cv_rmse=rmse, passes_sign_gate=passes))
    eligible = [c for c in candidates if c.passes_sign_gate]
    if not eligible:
        raise TrainingError("no alpha passes the sign gate; refusing to ship a model with nonsensical signs")
    best = min(eligible, key=lambda c: c.cv_rmse)
    rule = (
        "Lowest CV RMSE among the alphas whose coefficients for every size and quality feature "
        f"({', '.join(n for n in FEATURE_NAMES if n not in SIGN_GATE_EXEMPT)}) are positive"
    )
    return _ridge(best.alpha), Selection(rule=rule, candidates=candidates, chosen_alpha=best.alpha)


def _leverage(X: pd.DataFrame) -> dict:
    """What's needed to score how unusual a combination of inputs is (hat value on standardised X)."""
    mean, std = X.mean().to_numpy(), X.std(ddof=0).to_numpy()
    Z = np.column_stack([np.ones(len(X)), (X.to_numpy() - mean) / std])
    inverse = np.linalg.inv(Z.T @ Z)
    hat = np.einsum("ij,jk,ik->i", Z, inverse, Z)
    return {"mean": mean, "std": std, "inverse": inverse, "threshold": float(hat.max())}


def _price_distribution(y: pd.Series, width: float = 25_000) -> PriceDistribution:
    edges = np.arange(np.floor(y.min() / width) * width, np.ceil(y.max() / width) * width + width, width)
    counts, _ = np.histogram(y, bins=edges)
    return PriceDistribution(bin_edges=edges.tolist(), counts=counts.tolist())


def _notes(kind: ModelKind, coefficients: list[Coefficient], selection: Selection | None) -> list[str]:
    negative = [c.feature for c in coefficients if c.per_unit < 0 and c.feature not in SIGN_GATE_EXEMPT]
    notes = [
        "The 7 features are highly correlated with each other (variance inflation factors 14-212). Each "
        "coefficient is the price change when one feature moves and every other feature stays the same, "
        "which never happens in this data, so individual coefficients can look surprising even when the "
        "predictions are accurate.",
        "The intercept prices a home where every feature is 0 (built in year 0), so it means nothing on its "
        "own; baseline_at_mean is the prediction for the average home.",
        "distance_to_city_center has a positive coefficient because the larger, newer homes in this dataset "
        "are further out. That is confounding in the data, not an effect of distance itself.",
        "There are only 50 training rows, so the headline metrics are cross-validated (5-fold, 20 repeats) "
        "and still have wide spreads; the model was then refit on all rows.",
        "Inputs outside the training ranges, or unusual combinations of in-range inputs, return warnings. "
        "A predicted price at or below 0 is rejected with 422 rather than clamped.",
    ]
    if kind == "ols" and negative:
        notes.insert(
            1,
            f"Plain least squares, as the brief asks. {', '.join(negative)} get negative coefficients: with "
            "the features this correlated, lot size carries most of the size signal instead. A Ridge model "
            "with all-positive size and quality coefficients is served alongside as the Ridge set.",
        )
    if kind == "ridge" and selection is not None:
        notes.insert(
            1,
            f"Ridge with alpha={selection.chosen_alpha:g}, chosen by cross-validation among the alphas that "
            "keep every size and quality coefficient positive. metrics.ols_comparison shows what plain least "
            "squares scores on the same folds.",
        )
    return notes


def train(data_path: Path, out_dir: Path, kind: ModelKind, now: datetime | None = None) -> ModelInfo:
    X, y = load_dataset(data_path)
    selection = None
    if kind == "ols":
        estimator: RegressorMixin = LinearRegression()
    elif kind == "ridge":
        estimator, selection = _select_ridge(X, y)
    else:
        raise ValueError(f"unknown model kind {kind!r}")

    cv_metrics = _cv_metrics(estimator, X, y)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    holdout = _point_metrics(y_test, clone(estimator).fit(X_train, y_train).predict(X_test))
    estimator.fit(X, y)
    if kind == "ridge" and not _passes_sign_gate(estimator):
        raise TrainingError("the refit Ridge model fails the sign gate")

    per_unit, intercept, standardised = _per_unit(estimator)
    coefficients = [
        Coefficient(
            feature=f.name,
            per_unit=float(per_unit[i]),
            unit=f.unit,
            standardised=None if standardised is None else float(standardised[i]),
        )
        for i, f in enumerate(FEATURES)
    ]
    data_bytes = Path(data_path).read_bytes()
    sha = hashlib.sha256(data_bytes).hexdigest()
    now = now or datetime.now(UTC)
    leverage = _leverage(X)

    info = ModelInfo(
        model_type="linear_regression" if kind == "ols" else "ridge",
        model_version=f"{kind}-{now:%Y.%m.%d}-{sha[:8]}",
        trained_at=now.isoformat(timespec="seconds"),
        training_rows=len(X),
        sklearn_version=sklearn.__version__,
        dataset_sha256=sha,
        intercept=intercept,
        baseline_at_mean=float(estimator.predict(X.mean().to_frame().T)[0]),
        coefficients=coefficients,
        metrics=Metrics(
            evaluation_method="RepeatedKFold(n_splits=5, n_repeats=20, random_state=42); refit on all rows",
            cv=cv_metrics,
            in_sample=_point_metrics(y, estimator.predict(X)),
            holdout=holdout,
            baseline_mean=_cv_metrics(DummyRegressor(strategy="mean"), X, y),
            ols_comparison=_cv_metrics(LinearRegression(), X, y) if kind == "ridge" else None,
        ),
        features=[
            FeatureInfo(
                name=f.name,
                label=f.label,
                unit=f.unit,
                training_min=float(X[f.name].min()),
                training_max=float(X[f.name].max()),
                mean=float(X[f.name].mean()),
                allowed_min=f.hard_min,
                allowed_max=f.hard_max,
                step=f.step,
            )
            for f in FEATURES
        ],
        price_distribution=_price_distribution(y),
        leverage_threshold=leverage["threshold"],
        selection=selection,
        notes=_notes(kind, coefficients, selection),
    )

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump({"estimator": estimator, "leverage": leverage}, out_dir / MODEL_FILE)
    (out_dir / INFO_FILE).write_text(
        json.dumps(info.model_dump(mode="json"), indent=2) + "\n", encoding="utf-8"
    )
    return info


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data", type=Path, default=Path("../data/house_prices.csv"))
    parser.add_argument("--out", type=Path, default=Path("artifacts"))
    parser.add_argument("--kind", choices=["ols", "ridge"], default=os.environ.get("MODEL_KIND", "ols"))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    info = train(args.data, args.out, args.kind)
    cv = info.metrics.cv
    log.info(
        "trained %s on %d rows: CV R2 %.3f, RMSE %.0f, MAE %.0f",
        info.model_version,
        info.training_rows,
        cv.r2.mean,
        cv.rmse.mean,
        cv.mae.mean,
    )
    for c in info.coefficients:
        log.info("  %-24s %12.2f per %s", c.feature, c.per_unit, c.unit)


if __name__ == "__main__":
    main()
