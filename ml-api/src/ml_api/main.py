import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse

from ml_api.api import health, model_info, predict
from ml_api.config import Settings, get_settings
from ml_api.errors import BodyLimitMiddleware, register_error_handlers
from ml_api.model_store import ModelStore
from ml_api.observability import RequestContextMiddleware, configure_logging

log = logging.getLogger(__name__)

DESCRIPTION = """
Predicts house prices from 7 features with a linear model trained on the provided 50-row dataset.

* **`/predict`**: one property; add `?explain=true` for each feature's contribution.
* **`/predict/batch`**: 1-1,000 properties in one call (the example is the provided test file).
* **`/model-info`**: coefficients, cross-validated metrics, training ranges, and notes on reading them.
* **`/health`**: 200 when the model is loaded, 503 otherwise.

Inputs outside the training data come back with `warnings`. Errors are RFC 9457 `application/problem+json`.
"""


def create_app(settings: Settings | None = None, store: ModelStore | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.model_store = store
        if store is None:
            # A broken artifact must not kill the process: /health then reports 503 instead (doc 02, C5).
            try:
                app.state.model_store = ModelStore.load(settings.model_dir)
            except Exception:
                log.exception("model failed to load from %s", settings.model_dir)
        if app.state.model_store is not None:
            app.title = f"Property price model API ({app.state.model_store.describe()})"
            log.info("serving model %s", app.state.model_store.version)
        yield

    app = FastAPI(
        title="Property price model API",
        version="1.0.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "predict", "description": "Price predictions"},
            {"name": "model", "description": "What the model is and how well it does"},
            {"name": "health", "description": "For Docker and the gateway"},
        ],
    )
    register_error_handlers(app)
    app.add_middleware(BodyLimitMiddleware, max_body_size=settings.max_body_bytes)
    app.add_middleware(RequestContextMiddleware)  # added last, so it runs first
    for module in (predict, model_info, health):
        app.include_router(module.router)

    @app.get("/", include_in_schema=False)
    def root(request: Request) -> RedirectResponse:
        return RedirectResponse(f"{request.scope.get('root_path', '')}/docs")

    return app


configure_logging(get_settings().log_level)
app = create_app()
