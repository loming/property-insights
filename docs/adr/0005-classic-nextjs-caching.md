# 0005 · Next.js's classic caching model, not Cache Components

- **Status:** Accepted, 2 Nov 2026 (DEC-7)
- **Requirements:** TR-1c, TR-1d, TR-3c

## Context

`create-next-app` 16.4 turns on Cache Components (`"use cache"`, partial prerendering), and Next.js recommends it. Next.js 17 will make it the default. This portal has three constraints that bear on that choice:

- **No backends at build time.** Every page shows backend data, and the image is built with no backends running, in CI and in `docker build`.
- **One image, two sets.** `APP_VARIANT` must be read at runtime: if it were baked in at build time, both sets would look the same.
- **A deadline.** Fewer new concepts meant fewer surprises.

## Decision

The portal is scaffolded with `--no-cache-components` and uses the classic model. All caching goes through one server-only wrapper, [`portal/src/lib/api/client.ts`](../../portal/src/lib/api/client.ts):

- **Nothing is prerendered from backend data.** The wrapper calls `await connection()` before every backend fetch, so no page fetches during `next build`. CI's `next build` runs with no backends to prove it.
- **Each kind of data sets its own cache life.**

  | Data | Cached for |
  |---|---|
  | Model info | An hour (App 1) or 10 minutes (App 2), tag `model-info` |
  | Market aggregates | 5 minutes, tag `market` |
  | Live service status, history and comparisons | Not cached (`no-store`) |

- **Writes refresh the history.** The Server Actions that create and delete estimates call `revalidatePath("/estimator/history")`.
- **The set is read at runtime.** `APP_VARIANT` is read only after `connection()`, and passed down as a prop.

## Consequences

- Rendering is predictable: every route is dynamic, and caching sits in one file and can be explained line by line.
- A page shell is never served from a static cache before its data arrives. Loading skeletons and Suspense streaming do that job instead.
- This goes against the framework's current direction, so the migration path is written down.

## Migration to Cache Components

1. Set `cacheComponents: true` in `next.config.ts`.
2. In `src/lib/api`, replace the fetch options with `"use cache"` functions that call `cacheLife` and `cacheTag`, with the same lives and tags.
3. Keep runtime reads such as `APP_VARIANT` and the live status outside any cached scope, behind Suspense. Drop the `connection()` calls where a cached function already marks the boundary.
4. Run the browser tests on both hostnames to check that each still shows its own set.
