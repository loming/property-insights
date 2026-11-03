# syntax=docker/dockerfile:1
# Task 2 portal: Next.js standalone server, following the official with-docker stages (doc 02, E14).

# The same Node as local development (doc 02, A5).
FROM node:24.22.2-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No backend URLs exist here: every data-driven page renders at request time (doc 02, E2), and the
# server env is validated on first use, not at import (E3). next/font downloads Geist, so this needs
# network access.
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
# The fetch cache lives in .next/cache, which the non-root user must be able to write.
RUN mkdir .next && chown node:node .next
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
# Alpine has BusyBox wget but no curl. /api/health also validates the runtime configuration.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:3000/api/health"]
CMD ["node", "server.js"]
