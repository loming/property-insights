# 0003 · Public URLs through a Cloudflare Tunnel from the demo PC

- **Status:** Accepted, 2 Nov 2026 (DEC-4, DEC-17)
- **Requirements:** T1-5 ("containerise, and deploy"), C-2

## Context

"Build, containerise, and deploy" can be read as Docker on a laptop, or as a public URL. This PC already runs a Cloudflare Tunnel (the `Cloudflared` Windows service) that serves other sites under `loming.com`, at no cost.

## Decision

Two ingress rules in `C:\cloudflared\config.yml` send `hsbc.loming.com` and `hsbc-ridge.loming.com` to the gateway at `http://127.0.0.1:8130`, and the gateway's Host routing does the rest (ADR 0002). Both hostnames sit one label under `loming.com`, because Cloudflare's free certificate covers `*.loming.com` but not `*.hsbc.loming.com`.

Cloudflare Access (an emailed one-time PIN for the reviewers' addresses) is the intended lock for the review window. The apps have unauthenticated writes, and they publish the dataset.

Running it day to day is in [docs/hosting.md](../hosting.md).

## Consequences

- Task 1 was public as soon as Phase 1 ended, and every later phase went live the same way.
- The URLs work only while this PC is on, awake and signed in to Windows: Docker Desktop starts at sign-in, not at boot. [docs/hosting.md](../hosting.md) has the checklist for the review window, and `localhost:8130` is the fallback during a screen-shared demo.
- Visitors share one history. The gateway refuses to clear it, and the browser tests delete what they save.
- A new hostname needs an elevated `Restart-Service Cloudflared`, which briefly drops every site on the tunnel. A new path under an existing hostname is only a gateway change.
- The page content is neutral: a product name, "Property Insights", with no bank branding. The hostname's "hsbc" is a label for the reviewers.

## Alternatives considered

- **Cloud Run or a small VM.** More "production-like", but it costs money, needs a registry and secrets set up, and the stack would run somewhere other than where it's demoed.
- **Local only.** This is still the reviewer's path (`docker compose up`), but it reads "deploy" loosely.
