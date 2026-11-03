# 0004 · One Next.js portal with two independent apps

- **Status:** Accepted, 2 Nov 2026
- **Requirements:** P-0 to P-4, TR-1a to TR-1d, TR-4a

## Context

The brief wants "two independent applications" with different backends, in one portal with shared navigation and a consistent design.

## Decision

The two apps live in one Next.js 16 App Router project, `portal`:

- **Separate code.** Each app has its own route segment (`/estimator`, `/market`), with its own layout, sub-navigation, loading skeletons, error boundary and not-found page. Its code lives in its own feature folder (`src/features/estimator`, `src/features/market`), and an ESLint `no-restricted-imports` rule rejects imports between the two.
- **Separate backends.** App 1's server code calls only `estimator-api`, and App 2's only `market-api`. Each backend calls `ml-api` itself, so neither app depends on the other's backend.
- **Shared design.** The two apps share only the shell, the design system (`src/components`) and the server-only fetch wrapper (`src/lib/api`).
- **The browser talks only to the portal.** It never calls a backend or the gateway's API prefixes, so there's no CORS, and backend addresses stay private. The portal's server code reaches the backends over the compose network:
  - Server Components for reads.
  - Server Actions for App 1's writes (create and delete an estimate).
  - Route Handlers, a thin backend-for-frontend, for calls the browser makes after the page loads: what-if, sensitivity and file exports.

## Consequences

- With either backend stopped, that app shows its own error panel, with "Try again", while the shell and the other app keep working. CI checks this with both backends in turn ([`portal/e2e/resilience.spec.ts`](../../portal/e2e/resilience.spec.ts)).
- One build, one image and one design system to keep consistent, at the cost of the two apps deploying together.
- Splitting them later is mechanical: each feature folder already has a single backend and no imports from the other, which is what Next.js Multi-Zones would need.

## Alternatives considered

- **Multi-Zones (one Next.js app per app, joined by rewrites).** Truly separate deployments, at the cost of two builds, duplicated shell code and cross-zone navigation that reloads the page.
- **Micro-frontends (module federation).** The App Router doesn't support module federation well, and two small apps don't need it.
- **The browser calling the backends.** It's simpler for the what-if calls, but it brings CORS and public backend URLs, and gives up one place for request IDs and error mapping.
