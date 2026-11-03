# syntax=docker/dockerfile:1
# Task 2, App 1 backend. History lives in SQLite on the volume mounted at /data.

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

FROM ${PYTHON_IMAGE} AS runtime
# /data is created and owned by the app user here, so an empty named volume mounted on it picks up
# that ownership and the non-root process can write the database (doc 02, C7). The base image's pip, and
# the copy ensurepip keeps, are never used here: both go, with their advisories.
RUN useradd --create-home --uid 10001 app \
    && mkdir /data \
    && chown app:app /data \
    && python -m pip uninstall --yes --quiet --root-user-action=ignore pip \
    && python -c "import ensurepip, pathlib, shutil; shutil.rmtree(pathlib.Path(ensurepip.__file__).parent / '_bundled')"
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:${PATH}" \
    DATABASE_URL=sqlite+aiosqlite:////data/estimates.db \
    PYTHONUNBUFFERED=1
WORKDIR /app
USER app
EXPOSE 8001
# The slim image has no curl or wget (doc 02, C5). /health stays 200 while ml-api is down.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=2).status == 200 else 1)"]
# Trusting every forwarder is safe only because no service port is published (doc 03, DEC-14).
CMD ["uvicorn", "estimator_api.main:app", "--host", "0.0.0.0", "--port", "8001", "--proxy-headers", "--forwarded-allow-ips", "*"]
