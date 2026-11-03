from fastapi import APIRouter, Request, Response

from ml_api.schemas import Health

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=Health,
    summary="Liveness and readiness",
    responses={503: {"model": Health, "description": "The model didn't load"}},
)
def health(request: Request, response: Response) -> Health:
    """200 when the model is loaded and serving; 503 otherwise, so Docker marks the container unhealthy."""
    store = getattr(request.app.state, "model_store", None)
    if store is None:
        response.status_code = 503
        return Health(status="unavailable", model_loaded=False, model_version=None)
    return Health(status="ok", model_loaded=True, model_version=store.version)
