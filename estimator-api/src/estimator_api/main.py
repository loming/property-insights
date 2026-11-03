import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx2
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse

from estimator_api.api import estimates, system
from estimator_api.config import Settings, get_settings
from estimator_api.db import create_engine, create_schema, create_sessionmaker
from estimator_api.errors import BodyLimitMiddleware, register_error_handlers
from estimator_api.ml_client import CachedModelInfo, MlClient
from estimator_api.observability import RequestContextMiddleware, configure_logging

log = logging.getLogger(__name__)

DESCRIPTION = """
Backend of the **Property Value Estimator** (Task 2, App 1). Each estimate is priced by the Task 1 model
(`ml-api`) and saved, so the portal can show a history and compare properties side by side.

* **`POST /api/v1/estimates`**: validate, price, save. Nothing is saved if the model call fails.
* **`GET /api/v1/estimates`**, **`/{id}`**, **`/compare?ids=…&ids=…`**: history, detail, comparison.
* **`DELETE`** one estimate or the whole history.
* **`GET /api/v1/model-info`**: the model's metadata, cached, for the portal's form.

Model failures map to problem+json: the model's own 422s pass through, a model error is 502, and an
unreachable or timed-out model is 503.
"""


def create_app(
    settings: Settings | None = None, ml_transport: httpx2.AsyncBaseTransport | None = None
) -> FastAPI:
    """`ml_transport` lets tests stub ml-api with httpx2.MockTransport."""
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_engine(settings.database_url)
        await create_schema(engine)
        app.state.sessions = create_sessionmaker(engine)
        app.state.ml = MlClient(
            settings.ml_api_url,
            connect_timeout=settings.ml_connect_timeout,
            read_timeout=settings.ml_read_timeout,
            retries=settings.ml_retries,
            transport=ml_transport,
        )
        app.state.model_info = CachedModelInfo(app.state.ml, settings.model_info_ttl_seconds)
        log.info("ready; model service at %s", settings.ml_api_url)
        yield
        await app.state.ml.aclose()
        await engine.dispose()

    app = FastAPI(
        title="Property estimator API",
        version="1.0.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "estimates", "description": "Create, list, compare and delete estimates"},
            {"name": "model", "description": "The Task 1 model's metadata"},
            {"name": "health", "description": "For Docker and the gateway"},
        ],
    )
    register_error_handlers(app)
    app.add_middleware(BodyLimitMiddleware, max_body_size=settings.max_body_bytes)
    app.add_middleware(RequestContextMiddleware)  # added last, so it runs first
    app.include_router(estimates.router)
    app.include_router(system.router)

    @app.get("/", include_in_schema=False)
    def root(request: Request) -> RedirectResponse:
        return RedirectResponse(f"{request.scope.get('root_path', '')}/docs")

    return app


configure_logging(get_settings().log_level)
app = create_app()
