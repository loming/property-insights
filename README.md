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

> **Status: Task 1 and both Task 2 backends are complete** (`ml-api`, `estimator-api`, `market-api`), in both sets behind the gateway. The portal lands next; until it arrives, the site root opens Task 1's Swagger UI.

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
| App 1 backend Swagger (`estimator-api`) | http://localhost:8130/estimator-api/docs |
| App 2 backend Swagger (`market-api`) | http://localhost:8130/market-api/swagger-ui.html |

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

## App 1 backend: the estimator API (`estimator-api`)

FastAPI with SQLAlchemy 2.1 (async, SQLite on a named volume). Each estimate is priced by the Task 1 model and saved, so the portal can show a history and compare properties.

| Endpoint | What it does |
|---|---|
| `POST /api/v1/estimates` | Validates the input (the same limits as `ml-api`, kept in sync by a contract test), prices it through `ml-api` with per-feature contributions, and saves it. Nothing is saved if the model call fails. |
| `GET /api/v1/estimates` | The history, newest first, paged (`limit`, `offset`), with a `total`. |
| `GET /api/v1/estimates/{id}` | One estimate. |
| `GET /api/v1/estimates/compare?ids=…&ids=…` | 2–4 estimates side by side, with each feature's min and max for highlighting, and `missing_ids` for any that were deleted. |
| `DELETE /api/v1/estimates/{id}` | Deletes one estimate. Clearing the whole history (`DELETE /api/v1/estimates`) works only inside the compose network: the public gateway refuses it. |
| `GET /api/v1/model-info` | `ml-api`'s metadata, cached for 5 minutes and served stale while `ml-api` is down. |
| `GET /health` | 200 while the database works, reporting `ml_api` as `up` or `down`. |

**When the model fails**, nothing is saved, and the error says why:
- **The model rejects the input:** its 422 passes through, with field names under `features.*`.
- **The model answers with an error** or something unreadable: 502 `model-error`.
- **The model is unreachable, times out or has no model loaded:** 503 `model-unavailable`. Calls have a 2 s connect and 5 s read timeout, and only connection failures are retried, twice.

The history and comparison keep working while `ml-api` is down.

Each set has its own history: the Ridge set's `estimator-api-ridge` calls `ml-api-ridge` and keeps its own volume.

## App 2 backend: the market API (`market-api`)

Spring Boot 3.4.4 on Java 21 (records, pattern-matching `switch`, virtual threads), with Caffeine caching and springdoc. Spring Boot 3.4 is out of open-source support; the brief pins it, and production would move to a supported line (4.1.x) or run 3.4 under commercial support.

| Endpoint | What it does |
|---|---|
| `GET /api/v1/market/summary` | Count, price mean, median, quartiles, min and max, and mean price per sq ft |
| `GET /api/v1/market/segments?by=` | Per segment (`bedrooms`, `bathrooms`, `decade`, `school_band`, `distance_band`): count, mean and median price, price per sq ft |
| `GET /api/v1/market/segments/medians?by=` | Each segment's median home, rounded to values the model accepts: the what-if baselines |
| `GET /api/v1/market/distribution?metric=&bins=` | Histogram of price or price per sq ft |
| `GET /api/v1/market/correlations` | Each feature's correlation with price |
| `GET /api/v1/market/properties?sort=&page=&size=` | The rows, sorted and paged, with price per sq ft |
| `GET /api/v1/market/filter-options` | Ranges and values for building the filter UI |
| `POST /api/v1/market/what-if` | A baseline home and a changed one, priced by the Task 1 model in one call: delta, delta %, warnings |
| `POST /api/v1/market/what-if/sensitivity` | One feature swept over 2–50 steps in one model call |
| `GET /api/v1/market/model-info` | The model's metadata, cached, so App 2 never depends on App 1's backend |
| `GET /api/v1/market/export/csv`, `/export/pdf` | The filtered view as CSV or a PDF report |

Every statistics endpoint and export takes the same snake_case segment filters: `bedrooms` (repeatable), `min_`/`max_` `price`, `sqft`, `year`, `bathrooms`, `school_rating` and `distance`.

**Caching.**
- **Statistics:** cached with no expiry, since the dataset never changes while the app runs, and keyed by the immutable filter record.
- **What-if:** cached for 10 minutes, keyed by the request and the model version, so a retrained model never serves old prices. Failures are never cached.
- **HTTP:** statistics responses carry `Cache-Control: max-age=300` and ETags. Exports are `no-store`.
- **Evidence:** cache statistics are at `/actuator/caches` and `/actuator/metrics/cache.gets`.

**Errors** are problem+json in the same shape as the Python services. Validation is a 400 with snake_case field names. The model's failures map as in `estimator-api` (422, 502, 503), and a home the model can't price is named in the error.

**Build and test without installing a JDK**, using Maven inside the JDK image (the volume keeps Maven's downloads):

```bash
docker run --rm -v "${PWD}:/repo" -v market-api-m2:/root/.m2 -w /repo/market-api eclipse-temurin:21.0.13_9-jdk-resolute sh mvnw -B verify
```

## Repository layout

```text
├── data/            # the provided datasets: the single source of truth for training and analytics
├── gateway/         # nginx: one published port, routes to every service
├── ml-api/          # Task 1: FastAPI + scikit-learn
├── estimator-api/   # Task 2, App 1 backend: FastAPI + SQLite
├── market-api/      # Task 2, App 2 backend: Spring Boot 3.4.4 / Java 21
├── portal/          # Task 2: Next.js App Router portal                        (Phases 4–6)
└── docs/            # architecture, decisions (ADRs), demo script, hosting
```

## Data

`data/house_prices.csv` (50 labelled rows) and `data/test_data_for_prediction.csv` (10 unlabelled rows) are the provided files, converted to LF line endings without a byte-order mark, so the dataset hash and the model version are identical on every OS.

## Working on Windows

- `.gitattributes` stores every text file with LF endings and checks them out with LF, because they run inside Linux images. `.editorconfig` makes new files start with LF too.
- `make` isn't available on Windows; every `Makefile` target is a one-line `docker compose` command you can run directly.
