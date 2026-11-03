from fastapi import Request

from ml_api.errors import ModelNotLoadedError
from ml_api.model_store import ModelStore


def get_model_store(request: Request) -> ModelStore:
    """The loaded model, or a 503 problem. Tests override this to inject their own store."""
    store = getattr(request.app.state, "model_store", None)
    if store is None:
        raise ModelNotLoadedError
    return store
