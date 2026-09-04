# =============================================================================
# Swimly Next.js Web Application Dockerfile
# Multi-stage build optimised for production with standalone output.
# Usage (dev): docker build --target development .
# Usage (prod): docker build .
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Dependencies
# Install all dependencies for the monorepo workspace.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.json ./

# Copy shared packages (needed for workspace resolution)
COPY packages/ ./packages/

# Copy web app package.json
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Development
# For local development with hot reload.
# ---------------------------------------------------------------------------
FROM deps AS development

# Copy source code
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build shared packages
RUN pnpm --filter @swim-nexus/shared-types build && \
    pnpm --filter @swim-nexus/utils build

EXPOSE 3000

# Start Next.js dev server
CMD ["pnpm", "--filter", "web", "dev"]

# ---------------------------------------------------------------------------
# Stage 3: Builder
# Build shared packages then the Next.js application.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

WORKDIR /app

# Copy everything from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json /app/turbo.json /app/tsconfig.json ./

# Copy source code
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build shared packages first
RUN pnpm --filter @swim-nexus/shared-types build && \
    pnpm --filter @swim-nexus/utils build

# Set build-time environment variables
# NEXT_PUBLIC_ vars must be available at build time for Next.js to inline them
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# PostHog analytics. Empty defaults make the build succeed without the keys;
# the SDK silently no-ops if the key is empty.
ARG NEXT_PUBLIC_POSTHOG_KEY=
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ARG NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}

# Build the Next.js application
RUN pnpm --filter web build

# ---------------------------------------------------------------------------
# Stage 3: Runner
# Minimal production image using Next.js standalone output.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 swimly && \
    adduser --system --uid 1001 swimly

# Copy the standalone output (includes a minimal Node.js server)
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets (these are not included in standalone output)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public directory if it exists
COPY --from=builder /app/apps/web/public ./apps/web/public

USER swimly

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Next.js standalone output creates a server.js in the app directory
CMD ["node", "apps/web/server.js"]
