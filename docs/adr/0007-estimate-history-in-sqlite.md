# 0007 · Estimate history in SQLite, owned by estimator-api

- **Status:** Accepted, 2 Nov 2026 (DEC-5)
- **Requirements:** E-4, E-5, E-6

## Context

App 1 needs a history of previous estimates and a side-by-side comparison. The brief gives App 1 a Python backend, and doesn't mention users or authentication.

## Decision

`estimator-api` keeps the history in SQLite through SQLAlchemy 2.1's async engine (`aiosqlite`), on a named Docker volume. Each set has its own volume, so the two histories never mix. The Dockerfile creates `/data` owned by the app user, so the non-root process can write to an empty volume while the rest of the container stays read-only.

- **Saving.** An estimate is priced by `ml-api` first and saved only if that succeeds. A model failure saves nothing, and the error says why.
- **One history for everyone.** There is one anonymous user, so everyone shares the history. Single deletes are public; clearing everything works only inside the compose network (ADR 0002).
- **The comparison tray.** The tray of up to four estimates is browser state, in `localStorage` (ADR 0010). The comparison itself is read from `estimator-api` (`/api/v1/estimates/compare`), which reports ids that have since been deleted.

## Consequences

- The Python backend does real work, the history survives reloads and restarts, and the history page can be rendered on the server from it.
- No extra container: SQLite is a file.
- SQLite allows one writer at a time, which is fine for one instance and a demo's traffic.
- The schema is created at startup. Production would add Alembic migrations, and Postgres once there's more than one instance.

## Alternatives considered

- **The browser's `localStorage`.** It needs no backend, but then the Python backend would have nothing to own, and the history couldn't be rendered on the server.
- **Postgres.** It's the production answer, but it means another container, credentials and a healthcheck for 50-row demo data.
