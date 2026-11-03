# Property Insights

A full-stack take-home in two parts:

- **Task 1, `ml-api`:** a FastAPI + scikit-learn service that predicts house prices from 7 features, with `/predict`, `/predict/batch`, `/model-info` and `/health`, shown live through Swagger.
- **Task 2, `portal`:** a Next.js portal hosting two independent apps that both use the Task 1 model: a **Property Value Estimator** (FastAPI backend, `estimator-api`) and a **Property Market Analysis** dashboard (Spring Boot 3.4.4 / Java 21 backend, `market-api`).

Everything runs with Docker Compose behind a single nginx gateway port. Two sets of the same services can run side by side:

| Set | Model | Local URL | Started by |
|---|---|---|---|
| Brief | Plain linear regression, as the brief asks | http://localhost:8130 | `docker compose up` |
| Ridge | Ridge regression whose size and quality coefficients must be positive | http://ridge.localhost:8130 | `docker compose --profile ridge up` |

The brief set does exactly what was asked. The Ridge set shows what changes when the model's coefficients have to make sense; the reasons are in the model's `/model-info` notes.

> **Status: Phase 0, repository foundations.** The services land phase by phase; the commands below work once Phase 1 adds `compose.yaml`.

## Quick start

Prerequisites: Docker Engine with Docker Compose 2.38 or later (Docker Desktop includes both). Nothing else is needed to run the stack.

```bash
docker compose up --build --wait
```

Then open:

| What | URL |
|---|---|
| Portal | http://localhost:8130/ |
| Task 1 Swagger (`ml-api`) | http://localhost:8130/ml-api/docs |
| App 1 backend Swagger (`estimator-api`) | http://localhost:8130/estimator-api/docs |
| App 2 backend Swagger (`market-api`) | http://localhost:8130/market-api/swagger-ui.html |

For the Ridge set, add `--profile ridge` (or set `COMPOSE_PROFILES=ridge` in `.env`) and use `ridge.localhost` instead of `localhost`. To change the port, copy `.env.example` to `.env` and set `GATEWAY_PORT`.

## Repository layout

```text
├── data/            # the provided datasets: the single source of truth for training and analytics
├── gateway/         # nginx: one published port, routes to every service       (Phase 1)
├── ml-api/          # Task 1: FastAPI + scikit-learn                           (Phase 1)
├── estimator-api/   # Task 2, App 1 backend: FastAPI + SQLite                  (Phase 2)
├── market-api/      # Task 2, App 2 backend: Spring Boot 3.4.4 / Java 21       (Phase 3)
├── portal/          # Task 2: Next.js App Router portal                        (Phases 4–6)
└── docs/            # architecture, decisions (ADRs), demo script, hosting
```

## Data

`data/house_prices.csv` (50 labelled rows) and `data/test_data_for_prediction.csv` (10 unlabelled rows) are the provided files, converted to LF line endings without a byte-order mark, so the dataset hash and the model version are identical on every OS.

## Working on Windows

- `.gitattributes` stores every text file with LF endings and checks them out with LF, because they run inside Linux images. `.editorconfig` makes new files start with LF too.
- `make` isn't available on Windows; every `Makefile` target is a one-line `docker compose` command you can run directly.
