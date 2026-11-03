"""RFC 9457 problem+json for every error, so the portal parses all services' errors the same way."""

import logging
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.body_limit import RequestBodyLimitMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from ml_api.observability import request_id_var

PROBLEM_JSON = "application/problem+json"
log = logging.getLogger(__name__)

_TYPES = {404: "not-found", 405: "method-not-allowed", 413: "content-too-large"}


class ModelNotLoadedError(Exception):
    pass


class OutsideModelDomainError(Exception):
    def __init__(self, indices: list[int]) -> None:
        super().__init__(f"non-positive prediction at {indices}")
        self.indices = indices


def problem(
    request: Request,
    status: int,
    problem_type: str,
    detail: str,
    headers: dict[str, str] | None = None,
    **extra: Any,
) -> JSONResponse:
    body = {
        "type": problem_type,
        "title": HTTPStatus(status).phrase,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "request_id": request_id_var.get() or getattr(request.state, "request_id", None),
        **extra,
    }
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON, headers=headers)


def _field_name(loc: tuple[Any, ...]) -> str:
    """('body', 'items', 3, 'bathrooms') → 'items[3].bathrooms'."""
    name = ""
    for part in loc[1:] if loc and loc[0] in ("body", "query", "path") else loc:
        if isinstance(part, int):
            name += f"[{part}]"
        else:
            name += f".{part}" if name else str(part)
    return name or "body"


async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"field": _field_name(tuple(e["loc"])), "message": e["msg"]} for e in exc.errors()]
    return problem(request, 422, "validation-error", "The request has invalid fields", errors=errors)


async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else HTTPStatus(exc.status_code).description
    return problem(request, exc.status_code, _TYPES.get(exc.status_code, "about:blank"), detail, exc.headers)


async def _model_not_loaded(request: Request, exc: ModelNotLoadedError) -> JSONResponse:
    return problem(request, 503, "model-unavailable", "The model is not loaded; see /health")


async def _outside_domain(request: Request, exc: OutsideModelDomainError) -> JSONResponse:
    return problem(
        request,
        422,
        "outside-model-domain",
        "The model predicts a price at or below $0 for this input, which it cannot price. The input is "
        "valid but far from the homes it was trained on; check for unusual values.",
        indices=exc.indices,
    )


async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error")
    return problem(request, 500, "internal-error", "Something went wrong; quote the request_id when reporting it")


class BodyLimitMiddleware:
    """Caps request bodies at max_body_size (doc 02, C2).

    Starlette's RequestBodyLimitMiddleware also catches chunked and understated bodies, raising a 413
    that our handler turns into problem+json. But when Content-Length alone is too large it replaces
    whatever we answer with plain text, so that case is answered here first.
    """

    def __init__(self, app: ASGIApp, max_body_size: int) -> None:
        self.app = RequestBodyLimitMiddleware(app, max_body_size=max_body_size)
        self.max_body_size = max_body_size

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            length = Headers(scope=scope).get("content-length", "")
            if length.isdigit() and int(length) > self.max_body_size:
                detail = f"The request body is larger than {self.max_body_size:,} bytes"
                response = problem(Request(scope), 413, "content-too-large", detail)
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, _validation)
    app.add_exception_handler(StarletteHTTPException, _http)
    app.add_exception_handler(ModelNotLoadedError, _model_not_loaded)
    app.add_exception_handler(OutsideModelDomainError, _outside_domain)
    app.add_exception_handler(Exception, _unhandled)
