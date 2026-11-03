# 0009 · One wire contract: snake_case, problem+json errors and request IDs

- **Status:** Accepted, 2 Nov 2026 (DEC-12)
- **Requirements:** E-8, M-6, TR-3d

## Context

Four services in two languages share one set of features, and the portal has to turn any of their failures into a helpful message.

## Decision

- **snake_case everywhere.** Every JSON field and query parameter uses the dataset's names (`square_footage`, `min_price`), in Python, Java and TypeScript alike. Java's records keep camelCase in code: Jackson's `SNAKE_CASE` naming strategy and `@BindParam` map them, and the Swagger UI documents the names that actually bind.
- **RFC 9457 `application/problem+json` for every error:** `type`, `title`, `status`, `detail`, `instance`, `request_id`, plus `errors[{field, message}]` for validation. The model's failures map the same way in both backends:
  - Its 422 passes through.
  - An error or an unreadable answer is a 502 `model-error`.
  - Unreachable or timed out is a 503 `model-unavailable`.
  - A price at or below $0 is a 422 `outside-model-domain`.
- **A request ID across services.** The portal sends `X-Request-ID`. Each backend logs it, passes it on to `ml-api`, and returns it in the response header and in error bodies. Logs are structured JSON.
- **One feature definition per language, checked against the model.** Python's `features.py`, Java's `Feature` enum and the portal's `lib/features.ts` each define the seven features and their limits. A contract test in each consumer reads `ml-api`'s definition from the checkout, and fails if the limits differ:
  - [`estimator-api/tests/test_system.py`](../../estimator-api/tests/test_system.py)
  - [`FeatureContractTest`](../../market-api/src/test/java/com/propertyinsights/market/data/FeatureContractTest.java)
  - [`portal/src/lib/features.test.ts`](../../portal/src/lib/features.test.ts)

## Consequences

- No mapping layer between services, and no camelCase/snake_case bugs: the Swagger examples, the URLs and the CSV headers all use one vocabulary.
- The portal parses every failure the same way ([`portal/src/lib/api/client.ts`](../../portal/src/lib/api/client.ts)). It shows the field errors on the right fields, the model's reason when it can't price a home, and the request ID for anything unexpected.
- Adding a feature is a well-defined change, and a contract test fails until every service agrees on it.
- Java's usual camelCase stops at the edge of the code. A query parameter needs `@BindParam` plus a Swagger name, and a test checks that the documented names bind ([`ApiContractTest`](../../market-api/src/test/java/com/propertyinsights/market/web/ApiContractTest.java)).
