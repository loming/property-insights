# 0001 · Serve plain linear regression as briefed, and Ridge as a second set

- **Status:** Accepted, 2 Nov 2026 (DEC-1, DEC-15)
- **Requirements:** T1-2, T1-5, E-3, M-3

## Context

The brief asks for "a simple regression model" with an endpoint that returns its coefficients. On the 50 homes provided, the seven features rise and fall together: bigger homes have bigger lots, more bedrooms and newer builds. Plain least squares (`LinearRegression`) still predicts well (cross-validated RMSE $10.5k against $80.5k for predicting the mean), but it hands the size signal to lot size and gives square footage (−$103 per sq ft) and bedrooms (−$8.4k) negative coefficients. It also prices some valid-looking homes at $0 or less, such as the median home stretched to 4,100 sq ft.

A reviewer reading `/model-info` would ask about those signs. Changing the model quietly would not follow the brief.

## Decision

Two sets of the same services run side by side, built from the same code and images:

- **The brief set** serves `LinearRegression()` on all seven features in raw units: no scaling, no tuning. It is what `docker compose up` starts, and what `hsbc.loming.com` serves.
- **The Ridge set** (`--profile ridge`, `hsbc-ridge.loming.com`) trains Ridge with the most accurate α whose size and quality coefficients are all positive (α = 3). Only `ml-api`'s build argument `MODEL_KIND` differs; the other services take their set from environment variables.

Neither model's quirks are hidden:
- `/model-info` explains the coefficients.
- A price at or below $0 is a 422 `outside-model-domain` problem, never clamped.
- The portal says why more living area can lower a price under the brief set.

## Consequences

- The brief is followed literally, and the trade-off can be shown rather than described: the same estimate, what-if or `/model-info` on both hostnames. Ridge gives up about $400 of RMSE for coefficients that all point the expected way.
- Features that would mislead under OLS appear only in the Ridge set: the per-feature contribution waterfall (App 1) and the sensitivity line (App 2).
- Twice the containers. Each service's `-ridge` twin is a few lines of compose, and the image scan and browser tests cover both sets.

## Alternatives considered

- **Serve Ridge only.** Better coefficients, but not what was asked.
- **One `ml-api` with both models on different routes.** Fewer containers, but App 1 and App 2 would need a model switch threaded through every call, and the two sets could no longer be shown as independent deployments.
- **Non-negative least squares, or square footage alone.** Each fixes the signs by throwing away information, and predicts worse than either set.
