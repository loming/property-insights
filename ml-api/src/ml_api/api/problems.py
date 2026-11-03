"""OpenAPI documentation for the problem+json error responses."""

from typing import Any

from pydantic import BaseModel

from ml_api.errors import PROBLEM_JSON


class FieldError(BaseModel):
    field: str
    message: str


class Problem(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    request_id: str | None
    errors: list[FieldError] | None = None
    indices: list[int] | None = None


def _response(description: str) -> dict[str, Any]:
    return {"model": Problem, "description": description, "content": {PROBLEM_JSON: {}}}


PROBLEM_RESPONSES: dict[int, dict[str, Any]] = {
    413: _response("The request body is larger than 1 MB"),
    422: _response(
        "`validation-error`: missing, unknown or out-of-range fields, listed in `errors`; or "
        "`outside-model-domain`: the model predicts ≤ $0, with the offending `indices`"
    ),
    503: _response("`model-unavailable`: the model isn't loaded"),
}
