# syntax=docker/dockerfile:1
# Task 1 image. MODEL_KIND (ols | ridge) picks the model trained at build time; the dataset arrives
# through the Compose additional build context "data", so data/ stays the single source of truth.

ARG PYTHON_IMAGE=python:3.12.16-slim-trixie

FROM ${PYTHON_IMAGE} AS builder
# uv is pinned in three places: here, CI and pyproject.toml (doc 02, A4).
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /bin/uv
ENV UV_PYTHON_DOWNLOADS=0 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /src
# Dependencies first, so a code change doesn't reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-editable
COPY --from=data house_prices.csv /data/house_prices.csv
ARG MODEL_KIND=ols
RUN /app/.venv/bin/python -m ml_api.training.train \
    --data /data/house_prices.csv --out /app/artifacts --kind "${MODEL_KIND}"

FROM ${PYTHON_IMAGE} AS runtime
RUN useradd --create-home --uid 10001 app
# Only the virtualenv (with the package installed) and the trained artifacts: no uv, sources or tests.
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:${PATH}" \
    MODEL_DIR=/app/artifacts \
    PYTHONUNBUFFERED=1
WORKDIR /app
USER app
EXPOSE 8000
# The slim image has no curl or wget (doc 02, C5); /health answers 503 if the model didn't load.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"]
# Exec form, so signals and lifespan events reach uvicorn. Trusting every forwarder is safe only
# because no service port is published; the gateway is the only way in (doc 03, DEC-14).
CMD ["uvicorn", "ml_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
