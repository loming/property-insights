import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient

from estimator_api.config import Settings
from estimator_api.features import EXAMPLE_HOUSE
from estimator_api.main import create_app

PREDICTION = {
    "predicted_price": 250879.73,
    "currency": "USD",
    "model_version": "ols-test",
    "warnings": [],
    "contributions": {"baseline": 264600.0, "by_feature": {name: 0.0 for name in EXAMPLE_HOUSE}},
}
MODEL_INFO = {"model_type": "linear_regression", "model_version": "ols-test", "features": []}


class FakeMlApi:
    """Stands in for ml-api behind httpx2.MockTransport. Set `mode` to make /predict misbehave."""

    def __init__(self) -> None:
        self.mode = "ok"
        self.model_info_up = True
        self.requests: list[httpx2.Request] = []
        self.price = PREDICTION["predicted_price"]

    def __call__(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(request)
        if request.url.path == "/health":
            if self.mode == "down":
                raise httpx2.ConnectError("refused")
            return httpx2.Response(200, json={"status": "ok"})
        if request.url.path == "/model-info":
            if not self.model_info_up:
                raise httpx2.ConnectError("refused")
            return httpx2.Response(200, json=MODEL_INFO)
        return self._predict()

    def _predict(self) -> httpx2.Response:
        match self.mode:
            case "ok":
                return httpx2.Response(200, json={**PREDICTION, "predicted_price": self.price})
            case "warning":
                warning = {
                    "code": "OUTSIDE_TRAINING_RANGE",
                    "field": "year_built",
                    "value": 2020,
                    "message": "m",
                }
                return httpx2.Response(200, json={**PREDICTION, "warnings": [warning]})
            case "invalid":
                errors = [{"field": "bathrooms", "message": "Input should be a multiple of 0.5"}]
                return httpx2.Response(422, json={"type": "validation-error", "errors": errors})
            case "domain":
                return httpx2.Response(422, json={"type": "outside-model-domain", "detail": "Can't price it"})
            case "error":
                return httpx2.Response(500, json={"type": "internal-error"})
            case "no_model":
                return httpx2.Response(503, json={"type": "model-unavailable"})
            case "garbage":
                return httpx2.Response(200, content=b"<html>proxy error</html>")
            case "bad_shape":
                return httpx2.Response(200, json={**PREDICTION, "warnings": [{"nonsense": True}]})
            case "down":
                raise httpx2.ConnectError("refused")
            case "slow":
                raise httpx2.ReadTimeout("slow")
        raise AssertionError(self.mode)

    def predict_calls(self) -> list[dict[str, Any]]:
        return [json.loads(r.content) for r in self.requests if r.url.path == "/predict"]


@pytest.fixture
def ml() -> FakeMlApi:
    return FakeMlApi()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    # A temp-file database per test (doc 02, C7).
    return Settings(
        database_url=f"sqlite+aiosqlite:///{(tmp_path / 'estimates.db').as_posix()}",
        ml_api_url="http://ml-api",
    )


@pytest.fixture
def client(settings: Settings, ml: FakeMlApi) -> Iterator[TestClient]:
    with TestClient(create_app(settings, ml_transport=httpx2.MockTransport(ml))) as test_client:
        yield test_client
