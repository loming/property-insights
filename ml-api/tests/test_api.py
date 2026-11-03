from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ml_api.api.deps import get_model_store
from ml_api.config import Settings
from ml_api.features import EXAMPLE_BATCH, EXAMPLE_HOUSE
from ml_api.main import create_app

# Test-CSV row 1, from doc 03 §4.1.
EXPECTED_ROW_1 = {"ols": 250879.73, "ridge": 250932.28}
# The median training home grown to 4,100 sq ft: OLS prices it below $0 (doc 02, B5).
TOO_BIG = {
    **EXAMPLE_BATCH[0],
    "square_footage": 4100,
    "lot_size": 7025,
    "year_built": 1997,
    "distance_to_city_center": 4.05,
    "school_rating": 7.65,
}
# Extreme but valid input that Ridge also prices below $0.
EXTREME = {
    "square_footage": 300,
    "bedrooms": 0,
    "bathrooms": 0,
    "year_built": 1800,
    "lot_size": 500,
    "distance_to_city_center": 0,
    "school_rating": 0,
}


def assert_problem(response, status: int, problem_type: str) -> dict:
    assert response.status_code == status
    assert response.headers["content-type"] == "application/problem+json"
    body = response.json()
    assert body["type"] == problem_type
    assert body["status"] == status
    assert body["request_id"] == response.headers["x-request-id"]
    return body


def test_health(client: TestClient, kind: str) -> None:
    body = client.get("/health").json()
    assert body == {"status": "ok", "model_loaded": True, "model_version": body["model_version"]}
    assert body["model_version"].startswith(f"{kind}-")


def test_model_info_shape_depends_on_the_kind(client: TestClient, kind: str) -> None:
    body = client.get("/model-info").json()
    assert body["model_type"] == {"ols": "linear_regression", "ridge": "ridge"}[kind]
    assert [c["feature"] for c in body["coefficients"]] == list(EXAMPLE_HOUSE)
    assert body["metrics"]["cv"]["r2"]["mean"] > 0.95
    assert body["metrics"]["baseline_mean"]["r2"]["mean"] < 0
    assert body["notes"]
    ridge_only = (
        "selection" in body,
        "ols_comparison" in body["metrics"],
        "standardised" in body["coefficients"][0],
    )
    assert ridge_only == ((kind == "ridge"),) * 3


def test_predict_matches_the_documented_value(client: TestClient, kind: str) -> None:
    body = client.post("/predict", json=EXAMPLE_HOUSE).json()
    assert body["predicted_price"] == pytest.approx(EXPECTED_ROW_1[kind], abs=0.01)
    assert body["currency"] == "USD"
    assert body["warnings"] == []
    assert "contributions" not in body


def test_contributions_add_up_to_the_prediction(client: TestClient) -> None:
    body = client.post("/predict", params={"explain": "true"}, json=EXAMPLE_HOUSE).json()
    contributions = body["contributions"]
    assert set(contributions["by_feature"]) == set(EXAMPLE_HOUSE)
    total = contributions["baseline"] + sum(contributions["by_feature"].values())
    assert total == pytest.approx(body["predicted_price"], abs=0.05)


def test_batch_keeps_order_warns_on_the_extrapolating_rows_and_matches_single(client: TestClient) -> None:
    body = client.post("/predict/batch", json={"items": EXAMPLE_BATCH}).json()
    assert body["count"] == 10
    assert [p["index"] for p in body["predictions"]] == list(range(10))
    flagged = {
        p["index"]: sorted(w["field"] for w in p["warnings"]) for p in body["predictions"] if p["warnings"]
    }
    assert flagged == {5: ["school_rating", "year_built"], 7: ["distance_to_city_center"]}
    for item, prediction in zip(EXAMPLE_BATCH, body["predictions"], strict=True):
        assert client.post("/predict", json=item).json()["predicted_price"] == prediction["predicted_price"]


def test_unusual_combination_warns(client: TestClient) -> None:
    warnings = client.post("/predict", json={**EXAMPLE_HOUSE, "square_footage": 2150}).json()["warnings"]
    assert [w["code"] for w in warnings] == ["UNUSUAL_COMBINATION"]
    assert warnings[0]["value"] > 0.64


def test_ols_rejects_a_price_below_zero(artifacts: dict[str, Path]) -> None:
    with TestClient(create_app(Settings(model_dir=artifacts["ols"]))) as client:
        body = assert_problem(client.post("/predict", json=TOO_BIG), 422, "outside-model-domain")
        assert body["indices"] == [0]
        batch = client.post("/predict/batch", json={"items": [EXAMPLE_HOUSE, EXAMPLE_HOUSE, TOO_BIG]})
        assert assert_problem(batch, 422, "outside-model-domain")["indices"] == [2]


def test_ridge_prices_the_big_home_with_warnings(artifacts: dict[str, Path]) -> None:
    with TestClient(create_app(Settings(model_dir=artifacts["ridge"]))) as client:
        body = client.post("/predict", json=TOO_BIG).json()
        assert body["predicted_price"] > 0
        assert {w["code"] for w in body["warnings"]} == {"OUTSIDE_TRAINING_RANGE", "UNUSUAL_COMBINATION"}


def test_both_kinds_reject_extreme_input_priced_below_zero(client: TestClient) -> None:
    assert_problem(client.post("/predict", json=EXTREME), 422, "outside-model-domain")


@pytest.mark.parametrize(
    ("payload", "field", "message"),
    [
        ({k: v for k, v in EXAMPLE_HOUSE.items() if k != "lot_size"}, "lot_size", "Field required"),
        ({**EXAMPLE_HOUSE, "sqft": 1500}, "sqft", "Extra inputs are not permitted"),
        ({**EXAMPLE_HOUSE, "square_footage": 50}, "square_footage", "greater than or equal to 200"),
        ({**EXAMPLE_HOUSE, "school_rating": 11}, "school_rating", "less than or equal to 10"),
        ({**EXAMPLE_HOUSE, "bathrooms": 2.25}, "bathrooms", "multiple of 0.5"),
        ({**EXAMPLE_HOUSE, "bedrooms": 2.5}, "bedrooms", "valid integer"),
        ({**EXAMPLE_HOUSE, "year_built": "old"}, "year_built", "valid integer"),
    ],
)
def test_invalid_fields_are_listed(client: TestClient, payload: dict, field: str, message: str) -> None:
    body = assert_problem(client.post("/predict", json=payload), 422, "validation-error")
    assert [e["field"] for e in body["errors"]] == [field]
    assert message in body["errors"][0]["message"]


def test_nan_is_rejected(client: TestClient) -> None:
    raw = (
        b'{"square_footage": 1550, "bedrooms": 3, "bathrooms": 2, "year_built": 1997, "lot_size": NaN,'
        b' "distance_to_city_center": 4.1, "school_rating": 7.6}'
    )
    response = client.post("/predict", content=raw, headers={"content-type": "application/json"})
    assert assert_problem(response, 422, "validation-error")["errors"][0]["field"] == "lot_size"


@pytest.mark.parametrize(
    ("items", "message"), [([], "at least 1 item"), ([EXAMPLE_HOUSE] * 1001, "at most 1000")]
)
def test_batch_size_limits(client: TestClient, items: list, message: str) -> None:
    body = assert_problem(client.post("/predict/batch", json={"items": items}), 422, "validation-error")
    assert message in body["errors"][0]["message"]


def test_batch_errors_name_the_item(client: TestClient) -> None:
    items = [EXAMPLE_HOUSE, {**EXAMPLE_HOUSE, "bathrooms": -1}]
    body = assert_problem(client.post("/predict/batch", json={"items": items}), 422, "validation-error")
    assert body["errors"][0]["field"] == "items[1].bathrooms"


def test_request_ids_are_echoed_or_generated(client: TestClient) -> None:
    assert client.get("/health", headers={"X-Request-ID": "demo-42"}).headers["x-request-id"] == "demo-42"
    generated = client.get("/health", headers={"X-Request-ID": "not <safe> for logs"}).headers["x-request-id"]
    assert len(generated) == 32 and generated.isalnum()


def test_unknown_route_and_wrong_method_are_problems(client: TestClient) -> None:
    assert_problem(client.get("/nope"), 404, "not-found")
    response = client.get("/predict")
    assert_problem(response, 405, "method-not-allowed")
    assert response.headers["allow"] == "POST"


def test_oversized_bodies_are_rejected_both_ways(client: TestClient) -> None:
    big = b"{" + b" " * 1_100_000 + b"}"
    headers = {"content-type": "application/json"}
    assert_problem(client.post("/predict/batch", content=big, headers=headers), 413, "content-too-large")

    def chunked():
        for _ in range(12):
            yield b" " * 100_000

    assert_problem(
        client.post("/predict/batch", content=chunked(), headers=headers), 413, "content-too-large"
    )


def test_behind_the_gateway_prefix(artifacts: dict[str, Path]) -> None:
    app = create_app(Settings(model_dir=artifacts["ols"]))
    with TestClient(app, root_path="/ml-api") as client:
        assert client.get("/openapi.json").json()["servers"] == [{"url": "/ml-api"}]
        assert "/ml-api/openapi.json" in client.get("/docs").text
        assert client.get("/", follow_redirects=False).headers["location"] == "/ml-api/docs"
        assert client.post("/predict", json=EXAMPLE_HOUSE).status_code == 200


def test_missing_model_reports_unavailable(tmp_path: Path) -> None:
    with TestClient(create_app(Settings(model_dir=tmp_path))) as client:
        health = client.get("/health")
        assert health.status_code == 503
        assert health.json() == {"status": "unavailable", "model_loaded": False, "model_version": None}
        assert_problem(client.post("/predict", json=EXAMPLE_HOUSE), 503, "model-unavailable")
        assert_problem(client.get("/model-info"), 503, "model-unavailable")


def test_unexpected_errors_are_problems_without_internals(artifacts: dict[str, Path]) -> None:
    class Broken:
        version = "broken"

        def predict(self, rows):
            raise RuntimeError("secret internals")

    app = create_app(Settings(model_dir=artifacts["ols"]))
    app.dependency_overrides[get_model_store] = Broken
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post("/predict", json=EXAMPLE_HOUSE)
        assert response.status_code == 500
        body = response.json()
        assert body["type"] == "internal-error"
        assert body["request_id"]
        assert "secret" not in response.text


def test_openapi_documents_the_brief_endpoints(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert {"/predict", "/predict/batch", "/model-info", "/health"} <= set(paths)
