# 0010 · Where client state lives: the URL, a small store and the query cache

- **Status:** Accepted, 2 Nov 2026
- **Requirements:** M-2, M-3, E-2, E-5, TR-3a to TR-3c

## Context

The portal holds several kinds of state, each with a different owner and lifetime:
- what a page shows: filters, sort, a chart's split, the what-if baseline;
- what the visitor has picked: the comparison tray;
- answers fetched from the server as the visitor works: what-if prices;
- a form being filled in.

One global store for all of it would blur those differences.

## Decision

- **The URL holds what a page shows.** The market filters use the names `market-api` takes (`bedrooms`, `min_price`), and the server applies them, so a link shares the exact view.
  - A filter change goes through `router.replace` in a transition, with `useOptimistic` for the controls: the new values show at once, and the results dim until the server's page arrives.
  - State the server doesn't need (the table's sort, a chart's split, the what-if baseline) is written with `history.replaceState`, with no server round trip.
- **A small Zustand store holds the comparison tray.** Up to four estimates, kept in `localStorage` per hostname, so each set has its own. It's read only after hydration, and checked with Zod, since stored data is untrusted.
- **TanStack Query holds the what-if and sensitivity answers.** Requests are debounced (300 ms), cached by their inputs, and keep the previous answer on screen while the next one loads. A failure is retried once, and only for a 5xx or 429.
- **React Hook Form with Zod holds the estimate form.** The Server Action re-checks the input with the same schema.

## Consequences

- Reload, back and forward, and shared links all restore a market view. Nothing about it is lost in memory.
- Each kind of state uses the tool built for it, and there's no global store for server data.
- Filter sliders wait for a 400 ms pause before they change the URL. Without it, every arrow-key step would re-render the page on the server.
