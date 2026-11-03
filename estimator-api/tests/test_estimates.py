import uuid

import httpx2
import pytest
from fastapi.testclient import TestClient

from estimator_api.config import Settings
from estimator_api.features import EXAMPLE_HOUSE
from estimator_api.main import create_app
from tests.conftest import FakeMlApi

MISSING = "00000000-0000-0000-0000-000000000000"


def create(client: TestClient, label: str | None = None, **changes: float) -> dict:
    response = client.post(
        "/api/v1/estimates", json={"label": label, "features": {**EXAMPLE_HOUSE, **changes}}
    )
    assert response.status_code == 201, response.text
    return response.json()


def assert_problem(response, status: int, problem_type: str) -> dict:
    assert response.status_code == status, response.text
    assert response.headers["content-type"] == "application/problem+json"
    body = response.json()
    assert body["type"] == problem_type
    assert body["request_id"] == response.headers["x-request-id"]
    return body


def test_create_prices_through_the_model_and_saves(client: TestClient, ml: FakeMlApi) -> None:
    response = client.post(
        "/api/v1/estimates",
        json={"label": "  Flat on Elm St ", "features": EXAMPLE_HOUSE},
        headers={"X-Request-ID": "trace-1"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["label"] == "Flat on Elm St"
    assert body["predicted_price"] == 250879.73
    assert body["model_version"] == "ols-test"
    assert body["contributions"]["baseline"] == 264600.0
    assert body["created_at"].endswith("Z") or body["created_at"].endswith("+00:00")
    assert response.headers["location"].endswith(f"/api/v1/estimates/{body['id']}")
    assert client.get(f"/api/v1/estimates/{body['id']}").json() == body
    [request] = [r for r in ml.requests if r.url.path == "/predict"]
    assert request.url.params["explain"] == "true"
    assert request.headers["x-request-id"] == "trace-1"
    assert ml.predict_calls() == [EXAMPLE_HOUSE]


def test_model_warnings_are_saved(client: TestClient, ml: FakeMlApi) -> None:
    ml.mode = "warning"
    body = create(client, year_built=2020)
    assert [w["field"] for w in body["warnings"]] == ["year_built"]
    assert client.get(f"/api/v1/estimates/{body['id']}").json()["warnings"] == body["warnings"]


def test_history_is_newest_first_and_paged(client: TestClient, ml: FakeMlApi) -> None:
    ids = []
    for i in range(5):
        ml.price = 100_000.0 + i
        ids.append(create(client, label=f"home {i}")["id"])
    page = client.get("/api/v1/estimates", params={"limit": 2, "offset": 1}).json()
    assert page["total"] == 5
    assert (page["limit"], page["offset"]) == (2, 1)
    assert [e["id"] for e in page["items"]] == [ids[3], ids[2]]
    assert client.get("/api/v1/estimates").json()["items"][0]["id"] == ids[4]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
def test_history_paging_limits(client: TestClient, params: dict) -> None:
    assert_problem(client.get("/api/v1/estimates", params=params), 422, "validation-error")


def test_history_survives_a_restart(settings: Settings, ml: FakeMlApi) -> None:
    transport = httpx2.MockTransport(ml)
    with TestClient(create_app(settings, ml_transport=transport)) as client:
        saved = create(client, label="kept")
    with TestClient(create_app(settings, ml_transport=transport)) as client:
        assert client.get(f"/api/v1/estimates/{saved['id']}").json()["label"] == "kept"


def test_unknown_and_malformed_ids(client: TestClient) -> None:
    assert_problem(client.get(f"/api/v1/estimates/{MISSING}"), 404, "not-found")
    body = assert_problem(client.get("/api/v1/estimates/not-a-uuid"), 422, "validation-error")
    assert body["errors"][0]["field"] == "estimate_id"


def test_compare_keeps_order_reports_missing_and_ranges(client: TestClient, ml: FakeMlApi) -> None:
    ml.price = 200_000.0
    first = create(client, square_footage=1200)
    ml.price = 300_000.0
    second = create(client, square_footage=2000)
    response = client.get(
        "/api/v1/estimates/compare", params=[("ids", second["id"]), ("ids", MISSING), ("ids", first["id"])]
    )
    body = response.json()
    assert [e["id"] for e in body["estimates"]] == [second["id"], first["id"]]
    assert body["missing_ids"] == [MISSING]
    assert body["ranges"]["square_footage"] == {"min": 1200, "max": 2000}
    assert body["ranges"]["predicted_price"] == {"min": 200_000.0, "max": 300_000.0}
    assert body["ranges"]["bedrooms"] == {"min": 3, "max": 3}


def test_compare_validation(client: TestClient) -> None:
    one = create(client)["id"]
    same_twice = client.get("/api/v1/estimates/compare", params=[("ids", one), ("ids", one)])
    assert assert_problem(same_twice, 422, "validation-error")["errors"][0]["field"] == "ids"
    five = [("ids", str(uuid.uuid4())) for _ in range(5)]
    assert_problem(client.get("/api/v1/estimates/compare", params=five), 422, "validation-error")
    assert_problem(client.get("/api/v1/estimates/compare", params=[("ids", one)]), 422, "validation-error")
    none_exist = [("ids", MISSING), ("ids", str(uuid.uuid4()))]
    assert_problem(client.get("/api/v1/estimates/compare", params=none_exist), 404, "not-found")


def test_delete_one_and_all(client: TestClient) -> None:
    first, second, third = (create(client)["id"] for _ in range(3))
    assert client.delete(f"/api/v1/estimates/{first}").status_code == 204
    assert_problem(client.delete(f"/api/v1/estimates/{first}"), 404, "not-found")
    assert client.delete("/api/v1/estimates").json() == {"deleted": 2}
    assert client.get("/api/v1/estimates").json()["total"] == 0
    assert_problem(client.get(f"/api/v1/estimates/{second}"), 404, "not-found")


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"features": {k: v for k, v in EXAMPLE_HOUSE.items() if k != "lot_size"}}, "features.lot_size"),
        ({"features": {**EXAMPLE_HOUSE, "sqft": 1}}, "features.sqft"),
        ({"features": {**EXAMPLE_HOUSE, "bathrooms": 2.2}}, "features.bathrooms"),
        ({"features": {**EXAMPLE_HOUSE, "year_built": 1700}}, "features.year_built"),
        ({"label": "two\nlines", "features": EXAMPLE_HOUSE}, "label"),
        ({"label": "x" * 81, "features": EXAMPLE_HOUSE}, "label"),
        ({"label": "   ", "features": EXAMPLE_HOUSE}, "label"),
        ({"features": EXAMPLE_HOUSE, "extra": 1}, "extra"),
        ({}, "features"),
    ],
)
def test_invalid_input_is_rejected_before_any_model_call(
    client: TestClient, ml: FakeMlApi, payload: dict, field: str
) -> None:
    body = assert_problem(client.post("/api/v1/estimates", json=payload), 422, "validation-error")
    assert field in [e["field"] for e in body["errors"]]
    assert ml.predict_calls() == []


@pytest.mark.parametrize(
    ("mode", "status", "problem_type"),
    [
        ("invalid", 422, "validation-error"),
        ("domain", 422, "outside-model-domain"),
        ("error", 502, "model-error"),
        ("garbage", 502, "model-error"),
        ("bad_shape", 502, "model-error"),
        ("no_model", 503, "model-unavailable"),
        ("down", 503, "model-unavailable"),
        ("slow", 503, "model-unavailable"),
    ],
)
def test_model_failures_map_to_problems_and_save_nothing(
    client: TestClient, ml: FakeMlApi, mode: str, status: int, problem_type: str
) -> None:
    ml.mode = mode
    body = assert_problem(
        client.post("/api/v1/estimates", json={"features": EXAMPLE_HOUSE}), status, problem_type
    )
    if mode == "invalid":
        assert body["errors"] == [
            {"field": "features.bathrooms", "message": "Input should be a multiple of 0.5"}
        ]
    assert client.get("/api/v1/estimates").json()["total"] == 0


def test_oversized_body(client: TestClient) -> None:
    big = b"{" + b" " * 1_100_000 + b"}"
    response = client.post("/api/v1/estimates", content=big, headers={"content-type": "application/json"})
    assert_problem(response, 413, "content-too-large")
