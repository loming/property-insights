from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ml_api.config import Settings
from ml_api.main import create_app
from ml_api.training.train import train

DATA = Path(__file__).resolve().parents[2] / "data" / "house_prices.csv"


@pytest.fixture(scope="session")
def artifacts(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    """Both model kinds, trained once per test session on the real dataset."""
    out = {}
    for kind in ("ols", "ridge"):
        out[kind] = tmp_path_factory.mktemp(kind)
        train(DATA, out[kind], kind)
    return out


@pytest.fixture(params=["ols", "ridge"])
def kind(request: pytest.FixtureRequest) -> str:
    return request.param


@pytest.fixture
def client(artifacts: dict[str, Path], kind: str) -> Iterator[TestClient]:
    # The context manager runs the lifespan, which loads the model.
    with TestClient(create_app(Settings(model_dir=artifacts[kind]))) as test_client:
        yield test_client
