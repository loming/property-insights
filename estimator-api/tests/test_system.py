import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from estimator_api import features
from estimator_api.api.deps import get_service
from estimator_api.config import Settings
from estimator_api.main import create_app
from tests.conftest import MODEL_INFO, FakeMlApi

ML_API_FEATURES = Path(__file__).resolve().parents[2] / "ml-api" / "src" / "ml_api" / "features.py"


def test_model_info_is_passed_through_and_cached(client: TestClient, ml: FakeMlApi) -> None:
    assert client.get("/api/v1/model-info").json() == MODEL_INFO
    assert client.get("/api/v1/model-info").json() == MODEL_INFO
    assert [r.url.path for r in ml.requests].count("/model-info") == 1


def test_model_info_unavailable_before_first_fetch(client: TestClient, ml: FakeMlApi) -> None:
    ml.model_info_up = False
    response = client.get("/api/v1/model-info")
    assert response.status_code == 503
    assert response.json()["type"] == "model-unavailable"


def test_health_reports_the_model_service_without_failing(client: TestClient, ml: FakeMlApi) -> None:
    assert client.get("/health").json() == {"status": "ok", "database": "up", "ml_api": "up"}
    ml.mode = "down"
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "degraded", "database": "up", "ml_api": "down"}


def test_request_ids_are_echoed_or_generated(client: TestClient) -> None:
    assert client.get("/health", headers={"X-Request-ID": "abc-1"}).headers["x-request-id"] == "abc-1"
    generated = client.get("/health", headers={"X-Request-ID": "no <good>"}).headers["x-request-id"]
    assert len(generated) == 32 and generated.isalnum()


def test_behind_the_gateway_prefix(settings: Settings) -> None:
    with TestClient(create_app(settings), root_path="/estimator-api") as client:
        assert client.get("/openapi.json").json()["servers"] == [{"url": "/estimator-api"}]
        assert "/estimator-api/openapi.json" in client.get("/docs").text
        assert client.get("/", follow_redirects=False).headers["location"] == "/estimator-api/docs"


def test_unknown_routes_and_methods_are_problems(client: TestClient) -> None:
    assert client.get("/nope").json()["type"] == "not-found"
    response = client.put("/api/v1/estimates")
    assert response.json()["type"] == "method-not-allowed"


def test_unexpected_errors_are_problems_without_internals(settings: Settings) -> None:
    class Broken:
        async def page(self, limit: int, offset: int):
            raise RuntimeError("secret internals")

    app = create_app(settings)
    app.dependency_overrides[get_service] = Broken
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/estimates")
        assert response.status_code == 500
        assert response.json()["type"] == "internal-error"
        assert response.json()["request_id"]
        assert "secret" not in response.text


@pytest.mark.skipif(not ML_API_FEATURES.exists(), reason="needs the monorepo checkout")
def test_feature_limits_match_ml_api() -> None:
    """Contract: this service must reject exactly what ml-api rejects, or users see the model's errors."""
    spec = importlib.util.spec_from_file_location("ml_api_features", ML_API_FEATURES)
    assert spec and spec.loader
    ml_api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ml_api)
    assert tuple(features.Feature(**vars(f)) for f in ml_api.FEATURES) == features.FEATURES
    assert features.EXAMPLE_HOUSE == ml_api.EXAMPLE_HOUSE
