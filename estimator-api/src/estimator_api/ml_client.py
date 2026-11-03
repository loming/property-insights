"""The only way this service reaches the model: Task 1's HTTP contract (doc 03 §1)."""

import logging
import time
from typing import Any

import httpx2

log = logging.getLogger(__name__)


class MlApiError(Exception):
    """A model call that failed, carrying the problem this service answers with (doc 02, C6)."""

    status = 502
    problem_type = "model-error"

    def __init__(self, detail: str, errors: list[dict[str, str]] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.errors = errors


class ModelUnavailableError(MlApiError):
    """ml-api can't be reached, timed out, or has no model loaded."""

    status = 503
    problem_type = "model-unavailable"


class ModelResponseError(MlApiError):
    """ml-api answered with a server error or something unreadable."""


class ModelRejectedInputError(MlApiError):
    """ml-api refused the input: field errors, or a price it can't produce (outside-model-domain)."""

    status = 422

    def __init__(self, problem_type: str, detail: str, errors: list[dict[str, str]] | None = None) -> None:
        super().__init__(detail, errors)
        self.problem_type = problem_type


class MlClient:
    def __init__(
        self,
        base_url: str,
        connect_timeout: float = 2.0,
        read_timeout: float = 5.0,
        retries: int = 2,
        transport: httpx2.AsyncBaseTransport | None = None,
    ) -> None:
        # The transport's retries cover connection failures only, never an HTTP response (doc 02, C6).
        self._client = httpx2.AsyncClient(
            base_url=base_url,
            timeout=httpx2.Timeout(read_timeout, connect=connect_timeout),
            transport=transport or httpx2.AsyncHTTPTransport(retries=retries),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def predict(self, features: dict[str, float], request_id: str | None) -> dict[str, Any]:
        response = await self._request(
            "POST", "/predict", request_id, params={"explain": "true"}, json=features
        )
        if response.status_code == 200:
            body = self._json(response)
            if not isinstance(body.get("predicted_price"), int | float) or "model_version" not in body:
                raise ModelResponseError("ml-api returned a prediction without a price or model version")
            return body
        if response.status_code == 422:
            problem = self._json(response)
            if problem.get("type") == "outside-model-domain":
                raise ModelRejectedInputError(
                    "outside-model-domain", problem.get("detail", "Outside the model's domain")
                )
            if problem.get("type") == "validation-error":
                errors = [
                    {"field": f"features.{e.get('field', '')}", "message": e.get("message", "")}
                    for e in problem.get("errors") or []
                ]
                raise ModelRejectedInputError("validation-error", "The model rejected some fields", errors)
        raise self._unexpected(response)

    async def model_info(self, request_id: str | None) -> dict[str, Any]:
        response = await self._request("GET", "/model-info", request_id)
        if response.status_code == 200:
            return self._json(response)
        raise self._unexpected(response)

    async def is_up(self) -> bool:
        try:
            return (await self._client.get("/health", timeout=2.0)).status_code == 200
        except httpx2.HTTPError:
            return False

    async def _request(
        self, method: str, path: str, request_id: str | None, **kwargs: Any
    ) -> httpx2.Response:
        headers = {"X-Request-ID": request_id} if request_id else {}
        try:
            return await self._client.request(method, path, headers=headers, **kwargs)
        except httpx2.TimeoutException as exc:
            raise ModelUnavailableError("The model service timed out") from exc
        except httpx2.TransportError as exc:
            raise ModelUnavailableError("The model service can't be reached") from exc

    @staticmethod
    def _json(response: httpx2.Response) -> dict[str, Any]:
        try:
            body = response.json()
        except ValueError as exc:
            raise ModelResponseError("ml-api returned a body that isn't JSON") from exc
        if not isinstance(body, dict):
            raise ModelResponseError("ml-api returned an unexpected JSON shape")
        return body

    @staticmethod
    def _unexpected(response: httpx2.Response) -> MlApiError:
        if response.status_code == 503:
            return ModelUnavailableError("The model service is up but has no model loaded")
        return ModelResponseError(f"ml-api answered {response.status_code}")


class CachedModelInfo:
    """ml-api's /model-info, cached for a TTL, and served stale rather than failing while ml-api is down."""

    def __init__(self, client: MlClient, ttl_seconds: float) -> None:
        self._client = client
        self._ttl = ttl_seconds
        self._value: dict[str, Any] | None = None
        self._fetched_at = 0.0

    async def get(self, request_id: str | None) -> dict[str, Any]:
        if self._value is not None and time.monotonic() - self._fetched_at < self._ttl:
            return self._value
        try:
            self._value = await self._client.model_info(request_id)
            self._fetched_at = time.monotonic()
        except MlApiError:
            if self._value is None:
                raise
            log.warning("serving stale model-info: ml-api call failed")
        return self._value
