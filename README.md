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

> **Status: Task 1 is complete** (`ml-api` in both sets, behind the gateway). Task 2's services land next; until the portal arrives, the site root opens Task 1's Swagger UI.

## Quick start

Prerequisites: Docker Engine with Docker Compose 2.38 or later (Docker Desktop includes both). Nothing else is needed to run the stack.

```bash
docker compose up --build --wait
```

Then open:

| What | URL |
|---|---|
| Task 1 Swagger (`ml-api`) | http://localhost:8130/ml-api/docs |
| Portal (Task 2, coming) | http://localhost:8130/ |
| App 1 backend Swagger (`estimator-api`, coming) | http://localhost:8130/estimator-api/docs |
| App 2 backend Swagger (`market-api`, coming) | http://localhost:8130/market-api/swagger-ui.html |

For the Ridge set, add `--profile ridge` (or set `COMPOSE_PROFILES=ridge` in `.env`) and use `ridge.localhost` instead of `localhost`. To change the port, copy `.env.example` to `.env` and set `GATEWAY_PORT`.

## Task 1: the model API (`ml-api`)

| Endpoint | What it does |
|---|---|
| `POST /predict` | One property → predicted price, plus `warnings`. Add `?explain=true` for each feature's contribution relative to the average home. |
| `POST /predict/batch` | 1–1,000 properties in one call; predictions come back in input order with a 0-based `index`. The Swagger example is the provided test file. |
| `GET /model-info` | Model type and version, per-unit coefficients, cross-validated metrics against a predict-the-mean baseline, training ranges, and notes on reading the coefficients. |
| `GET /health` | 200 when the model is loaded; 503 if it failed to load, so Docker marks the container unhealthy. |

**The two models.** Both use all 7 features and are trained when the image is built (`MODEL_KIND` build arg), then evaluated with 5-fold cross-validation repeated 20 times:

| Set | Model | CV R² | CV RMSE | CV MAE |
|---|---|---|---|---|
| Brief | Plain linear regression (`LinearRegression`) | 0.972 | $10.5k | $7.6k |
| Ridge | Ridge, α = 3: the most accurate α whose size and quality coefficients are all positive | 0.976 | $10.9k | $9.6k |
| — | Predict-the-mean baseline | −0.19 | $80.5k | $70.3k |

The features are strongly correlated with each other, so plain linear regression predicts well but gives square footage (−$103 per sq ft) and bedrooms negative coefficients: lot size carries the size signal instead. The brief set serves it as asked, with that explained in `/model-info`. The Ridge set gives up about $400 of RMSE for coefficients that all point the expected way.

**Guard rails.**
- **Validation:** every field is required and range-checked, and unknown fields are rejected.
- **Warnings:** inputs outside the training range get an `OUTSIDE_TRAINING_RANGE` warning, and in-range inputs whose combination is unlike any training home get `UNUSUAL_COMBINATION`.
- **Prices at or below $0:** rejected with a 422 `outside-model-domain` problem rather than clamped. Plain linear regression hits this for a 4,100 sq ft median home.
- **Errors:** every error is RFC 9457 `application/problem+json` with a `request_id`, which also comes back as the `X-Request-ID` header.

**Develop and test** (needs [uv](https://docs.astral.sh/uv/) 0.11.28):

```bash
cd ml-api
uv sync
uv run pytest
uv run python -m ml_api.training.train --kind ols --out artifacts
```

## Repository layout

```text
├── data/            # the provided datasets: the single source of truth for training and analytics
├── gateway/         # nginx: one published port, routes to every service
├── ml-api/          # Task 1: FastAPI + scikit-learn
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
