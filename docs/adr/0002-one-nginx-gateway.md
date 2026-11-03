# 0002 · One nginx gateway and one published port

- **Status:** Accepted, 2 Nov 2026 (DEC-14, DEC-16)
- **Requirements:** T1-6, C-2

## Context

There are nine containers across the two sets, and four kinds of page to reach: the portal and three Swagger UIs. The demo PC already runs other projects (port 8000 was taken), and the public tunnel needs a single local address.

## Decision

The only published port is the nginx gateway's, `127.0.0.1:${GATEWAY_PORT:-8130}` ([`gateway/conf.d/default.conf`](../../gateway/conf.d/default.conf)). Each request is routed by two things:
- **The Host header picks the set:** `hsbc-ridge.loming.com` and `ridge.localhost` reach the Ridge set; anything else reaches the brief set.
- **The path prefix picks the service:**
  - `/ml-api/`, `/estimator-api/` and `/market-api/` reach each backend's API and Swagger UI, with the prefix stripped and passed on as `X-Forwarded-Prefix`.
  - `/` reaches the portal.

Upstreams are nginx variables resolved by Docker's DNS on each request, so the gateway starts without the Ridge profile and follows recreated containers.

The gateway also carries the edge rules:
- **Per-visitor rate limits**, keyed on Cloudflare's `CF-Connecting-IP`:
  - API calls: 100 a second, bursts of 400.
  - Page loads: 200 a second, bursts of 600.
  - Link prefetches: 500 a second, bursts of 2,000, counted separately so they can't use up the page budget.
- **A 1 MB body limit.**
- **Clearing the whole history is refused publicly:** a `DELETE /estimator-api/api/v1/estimates`. Deleting one estimate at a time still works.
- **Errors in the caller's format:** problem+json on API paths, a small HTML page on portal paths.
- **Streaming:** `proxy_buffering off` on the portal location, so Suspense streaming reaches the browser as it happens.

## Consequences

- One port to tunnel, bind to loopback and secure. Every other service is reachable only on the compose network.
- The portal never calls the backends through the gateway: its server code uses compose DNS directly (ADR 0004), so the rate limits apply to visitors, not to the portal's own fan-out.
- The forwarded headers had to be exact. Next.js compares the forwarded `Host` with `Origin` before it runs a Server Action, and nginx's `$host` drops the port, so the gateway forwards the Host as the browser sent it ([`gateway/snippets/proxy_headers.conf`](../../gateway/snippets/proxy_headers.conf)).
- Changing a rate-limit zone's key needs `docker compose restart gateway`. `nginx -s reload` rejects it and keeps the old configuration, logging only an `[emerg]` line.

## Alternatives considered

- **A published port per service.** That means more ports on a shared PC, nine tunnel rules, and CORS between the portal and the APIs.
- **Traefik with container labels.** Capable, but its routing is spread across compose labels, which is harder to read and explain than one nginx file.
- **Next.js rewrites to the backends.** That would tie Task 1's Swagger UI to the portal's uptime, and make Next.js an API proxy.
