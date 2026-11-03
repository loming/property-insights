"""OpenAPI documentation for the problem+json error responses."""

from typing import Any

from pydantic import BaseModel

from estimator_api.errors import PROBLEM_JSON


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


def _response(description: str) -> dict[str, Any]:
    return {"model": Problem, "description": description, "content": {PROBLEM_JSON: {}}}


PROBLEMS: dict[int, dict[str, Any]] = {
    404: _response("`not-found`: no such estimate"),
    413: _response("The request body is larger than 1 MB"),
    422: _response(
        "`validation-error`: invalid fields, listed in `errors` (checked here, or by the model); or "
        "`outside-model-domain`: the model can't price this input"
    ),
    502: _response("`model-error`: the model service answered with an error or something unreadable"),
    503: _response("`model-unavailable`: the model service is down, timed out or has no model loaded"),
}
