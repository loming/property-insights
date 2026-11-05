# Demo script (about 21 minutes)

Everything runs from https://hsbc.loming.com (the brief set) and https://hsbc-ridge.loming.com (the Ridge set). If the tunnel or the network misbehaves, use http://localhost:8130 and http://ridge.localhost:8130 on the demo PC: the same pages, without Cloudflare.

## Before the call

- [ ] **The stack is up and healthy:** `docker compose ps` shows nine containers, every one healthy or running.
- [ ] **Both hostnames answer:** the two `curl` checks in [hosting.md](hosting.md#checking-it).
- [ ] **No leftover test estimates** in either set's history (delete them from the History page).
- [ ] **Browser tabs open,** at 125% zoom so the screen share is readable:
  1. The README on GitHub
  2. https://hsbc.loming.com/ml-api/docs
  3. https://hsbc-ridge.loming.com/ml-api/docs
  4. https://hsbc.loming.com/estimator
  5. https://hsbc-ridge.loming.com/estimator
  6. https://hsbc.loming.com/market
  7. https://hsbc.loming.com/market-api/swagger-ui.html
- [ ] **A terminal in the repository,** for `docker compose` (step 6).
- [ ] **The latest CI run** open on GitHub Actions.

## 1. Context (1 min)

Show the README's architecture diagram and the requirements traceability.

> "Two tasks, one repository. The brief set does exactly what was asked, plain linear regression; the Ridge set is the same code with the model I'd ship. One nginx port serves both; the Host header picks the set."

## 2. Ops (1 min)

```bash
docker compose ps
```

Nine containers: both sets, plus the gateway, the only published port. Everything is non-root and on a read-only filesystem; the images are built in CI and scanned.

## 3. Task 1 in Swagger (5 min)

On https://hsbc.loming.com/ml-api/docs:

1. **`GET /health`:** the model is loaded, with its version.
2. **`GET /model-info`:**
   - Cross-validated R² 0.97 and RMSE about $10.5k, against $80.5k for predicting the mean.
   - Square footage (−$103 per sq ft) and bedrooms (−$8.4k) are negative: the features move together in this data, so least squares gives the size signal to lot size. "Holding the others constant" never happens in these 50 homes.
   - The intercept is beside `baseline_at_mean`, the average home's price.
3. **`POST /predict`, example `typical`:** a price and no warnings. Then `extrapolating`: a price with an `OUTSIDE_TRAINING_RANGE` warning. Then `too_big`: a 422 `outside-model-domain`, because plain least squares prices that home at $0 or less, and the API says so rather than clamping.
4. **`POST /predict/batch`, example `test_csv`:** the 10 rows of the provided test file, in order. Rows with `index` 5 and 7 come back with warnings.
5. **A 422:** in `/predict`, change `bedrooms` to `"three"` or add an unknown field. Each error names its field.

Then https://hsbc-ridge.loming.com/ml-api/docs, `GET /model-info`: every size and quality coefficient points the expected way, for about $400 more RMSE and $2,100 more MAE. Distance is still positive: it's confounded with size, which Ridge can't fix.

## 4. App 1, the estimator (5 min)

On https://hsbc.loming.com/estimator, using the keyboard only:

1. Clear Living area, set Bathrooms to 2.3, press Enter. The error summary lists both fields and links to them, focus moves to the first, and each field shows its own error.
2. Fix both, add the label "Demo, Elm St", press Enter. The result shows the price, the inputs as a table, and where the price sits among the 50 sales.
3. **Compare** on the result adds it to the tray. Open **History**: it's saved, newest first. Add two more from the history, then **Compare** in the tray. The estimates sit in columns, with each row's highest and lowest value marked, and the prices and features charted.
4. On https://hsbc-ridge.loming.com/estimator, price the same home: the Ridge set also shows what each feature adds to or takes from the average home's price.

## 5. App 2, market analysis (5 min)

On https://hsbc.loming.com/market:

1. **Filters:** tick 3 bed and narrow the price. The URL changes; open it in a new tab and the same view loads, filtered by the server. Change **Split by** to Decade built.
2. **Data:** the same filters carry over. Sort by Price per sq ft and search for a value. In the browser's device toolbar (Ctrl+Shift+M) at a phone's width, the table scrolls inside its box with the home number pinned. **Export** → CSV, then PDF: the filtered homes in the table's order.
3. **What-if** (brief set): start from the typical 3-bed home.
   - Raise **Lot size**, then **School rating**: the price rises, and "How the change adds up" shows each change × its coefficient.
   - Raise **Living area**: the price falls. The page explains why, and the leverage warning appears once the combination leaves the data.
4. The same on https://hsbc-ridge.loming.com/market/what-if: living area raises the price, and the line below shows the price across one feature's whole range, from one batch call.
5. The Java backend: https://hsbc.loming.com/market-api/swagger-ui.html, then the cache statistics at `/market-api/actuator/caches` and `/market-api/actuator/metrics/cache.gets`.

## 6. Resilience (2 min)

```bash
docker compose stop ml-api
```

- **The brief set's estimator** says the pricing service isn't responding, and saves nothing. Its history and comparison still work.
- **The brief set's market dashboard and table** keep working: they don't need the model.
- **Its what-if page** still shows prices `market-api` has already worked out: what-if results are cached for 10 minutes. Move a slider to a new value, and the page says the model isn't answering.
- **The Ridge set** is untouched.

```bash
docker compose start ml-api
```

Everything recovers: "Try again" on the what-if page, or a reload.

## 7. Code and quality (2 min)

- **Layout:** one folder per service, and `src/features/estimator` and `src/features/market` kept apart by a lint rule.
- **The gateway:** `gateway/conf.d/default.conf`.
- **A test or two:**
  - the contract test that keeps each consumer's feature limits equal to `ml-api`'s;
  - `portal/e2e/keyboard.spec.ts`, the keyboard-only walks.
- **The CI run:** each service's lint, types and tests, then both sets built and tested through the gateway. That covers Playwright with axe, the keyboard walks, the backend-down checks and the image scan.
- **Next steps:** the [README](../README.md#limitations-and-next-steps).

## After the call

Delete the demo's estimates from both sets' History pages.

## If something goes wrong

| Problem | Fallback |
|---|---|
| The tunnel or the network is down | `localhost:8130` and `ridge.localhost:8130` on the demo PC |
| A container is unhealthy | `docker compose up -d --wait`, then `docker compose logs <service>` |
| Too many requests (429) | Wait two seconds. The limits are per visitor and generous |
| The PC itself fails | The recorded walkthrough: a silent, captioned run through steps 3–6, made by [`portal/scripts/record-walkthrough.mjs`](../portal/scripts/record-walkthrough.mjs). Re-record it after any change to the UI. |
