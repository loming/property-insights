from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ml_api.features import FEATURE_NAMES
from ml_api.schemas import Contributions, ModelInfo, PredictionWarning
from ml_api.training.train import INFO_FILE, MODEL_FILE


class ModelStore:
    """The loaded artifact: predictions plus everything needed to explain and qualify them."""

    def __init__(self, estimator: Any, leverage: dict[str, Any], info: ModelInfo) -> None:
        self._estimator = estimator
        self._leverage = leverage
        self.info = info
        self._per_unit = np.array([c.per_unit for c in info.coefficients])
        self._means = np.array([f.mean for f in info.features])

    @classmethod
    def load(cls, model_dir: Path) -> "ModelStore":
        # Only artifacts built inside our own image are loaded: joblib runs code on load (doc 02, B7).
        bundle = joblib.load(Path(model_dir) / MODEL_FILE)
        info = ModelInfo.model_validate_json((Path(model_dir) / INFO_FILE).read_text(encoding="utf-8"))
        return cls(bundle["estimator"], bundle["leverage"], info)

    @property
    def version(self) -> str:
        return self.info.model_version

    def predict(self, rows: list[dict[str, float]]) -> np.ndarray:
        # A DataFrame with the training column order: scikit-learn checks the feature names (doc 02, B6).
        return self._estimator.predict(pd.DataFrame(rows, columns=FEATURE_NAMES))

    def leverage(self, rows: list[dict[str, float]]) -> np.ndarray:
        x = np.array([[row[name] for name in FEATURE_NAMES] for row in rows], dtype=float)
        z = np.column_stack([np.ones(len(x)), (x - self._leverage["mean"]) / self._leverage["std"]])
        return np.einsum("ij,jk,ik->i", z, self._leverage["inverse"], z)

    def warnings(self, rows: list[dict[str, float]]) -> list[list[PredictionWarning]]:
        threshold = self.info.leverage_threshold
        result = []
        for row, hat in zip(rows, self.leverage(rows), strict=True):
            found = [
                PredictionWarning(
                    code="OUTSIDE_TRAINING_RANGE",
                    field=f.name,
                    value=row[f.name],
                    message=f"Training data covers {f.training_min:g}–{f.training_max:g}; this estimate extrapolates",
                )
                for f in self.info.features
                if not f.training_min <= row[f.name] <= f.training_max
            ]
            if hat > threshold:
                found.append(
                    PredictionWarning(
                        code="UNUSUAL_COMBINATION",
                        value=round(float(hat), 3),
                        message=f"This combination of features is unlike any home in the training data "
                        f"(leverage {hat:.2f}, training maximum {threshold:.2f}); treat the estimate with caution",
                    )
                )
            result.append(found)
        return result

    def contributions(self, row: dict[str, float]) -> Contributions:
        x = np.array([row[name] for name in FEATURE_NAMES], dtype=float)
        by_feature = self._per_unit * (x - self._means)
        return Contributions(
            baseline=round(self.info.baseline_at_mean, 2),
            by_feature={name: round(float(v), 2) for name, v in zip(FEATURE_NAMES, by_feature, strict=True)},
        )

    def describe(self) -> str:
        return "linear regression, as briefed" if self.info.model_type == "linear_regression" else "Ridge"
