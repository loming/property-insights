import json
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd
import pytest

from ml_api.features import FEATURE_NAMES
from ml_api.schemas import ModelInfo
from ml_api.training import train as training
from ml_api.training.train import INFO_FILE, DatasetError, TrainingError, load_dataset, train
from tests.conftest import DATA


def info(model_dir: Path) -> ModelInfo:
    return ModelInfo.model_validate_json((model_dir / INFO_FILE).read_text(encoding="utf-8"))


def coefficient(model: ModelInfo, feature: str) -> float:
    return next(c.per_unit for c in model.coefficients if c.feature == feature)


def test_ols_matches_the_planning_analysis(artifacts: dict[str, Path]) -> None:
    model = info(artifacts["ols"])
    assert model.model_type == "linear_regression"
    # Golden values: a change in the data or the pipeline must be deliberate.
    assert coefficient(model, "square_footage") == pytest.approx(-102.92, abs=0.01)
    assert coefficient(model, "bedrooms") == pytest.approx(-8447.78, abs=0.01)
    assert coefficient(model, "school_rating") == pytest.approx(21062.08, abs=0.01)
    assert model.intercept == pytest.approx(-299786.61, abs=0.01)
    assert model.baseline_at_mean == pytest.approx(264600.0)
    assert model.metrics.cv.rmse.mean == pytest.approx(10540, abs=1)
    assert model.metrics.cv.mae.mean == pytest.approx(7561, abs=1)
    assert model.selection is None
    assert model.metrics.ols_comparison is None


def test_ridge_picks_the_smallest_alpha_that_passes_the_sign_gate(artifacts: dict[str, Path]) -> None:
    model = info(artifacts["ridge"])
    assert model.model_type == "ridge"
    assert model.selection is not None
    assert model.selection.chosen_alpha == 3.0
    failing = [c.alpha for c in model.selection.candidates if not c.passes_sign_gate]
    assert failing == [0.1, 0.3, 1.0, 2.0]
    for c in model.coefficients:
        if c.feature != "distance_to_city_center":
            assert c.per_unit > 0, c.feature
        assert c.standardised is not None
    assert model.metrics.cv.rmse.mean == pytest.approx(10922, abs=1)
    assert model.metrics.ols_comparison is not None


def test_ridge_training_refuses_when_no_alpha_passes_the_gate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(training, "ALPHAS", (0.1, 1.0))
    with pytest.raises(TrainingError, match="sign gate"):
        train(DATA, tmp_path, "ridge")


@pytest.mark.parametrize("kind", ["ols", "ridge"])
def test_training_is_deterministic(tmp_path: Path, kind: str) -> None:
    now = datetime(2026, 11, 3, tzinfo=UTC)
    train(DATA, tmp_path / "a", kind, now=now)
    train(DATA, tmp_path / "b", kind, now=now)
    first = json.loads((tmp_path / "a" / INFO_FILE).read_text(encoding="utf-8"))
    second = json.loads((tmp_path / "b" / INFO_FILE).read_text(encoding="utf-8"))
    assert first == second
    assert first["model_version"] == f"{kind}-2026.11.03-ee42b8fc"


def test_metadata_records_the_training_ranges(artifacts: dict[str, Path]) -> None:
    data = pd.read_csv(DATA)
    for feature in info(artifacts["ols"]).features:
        assert feature.training_min == data[feature.name].min()
        assert feature.training_max == data[feature.name].max()
    distribution = info(artifacts["ols"]).price_distribution
    assert sum(distribution.counts) == len(data)
    assert (
        distribution.bin_edges[0] <= data["price"].min() <= data["price"].max() <= distribution.bin_edges[-1]
    )


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda df: df.drop(columns=["lot_size"]), "missing columns"),
        (lambda df: df.assign(bedrooms=df["bedrooms"].astype(str) + "br"), "non-numeric"),
        (lambda df: df.assign(price=df["price"].where(df.index != 3)), "null values"),
        (lambda df: df.head(5), "only 5 rows"),
    ],
)
def test_bad_datasets_fail_fast(tmp_path: Path, change, message: str) -> None:
    path = tmp_path / "data.csv"
    change(pd.read_csv(DATA)).to_csv(path, index=False)
    with pytest.raises(DatasetError, match=message):
        load_dataset(path)


def test_id_is_never_a_feature() -> None:
    X, _ = load_dataset(DATA)
    assert list(X.columns) == FEATURE_NAMES
