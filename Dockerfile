# =============================================================================
# Swimly NestJS Service Dockerfile
# Multi-stage build for any service in the services/ directory.
# Usage (dev): docker build --build-arg SERVICE_NAME=membership --target development .
# Usage (prod): docker build --build-arg SERVICE_NAME=membership .
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base
# Installs all dependencies for development and building.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

# Accept the service name as a build argument
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

WORKDIR /app

# Copy workspace configuration files first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.json ./

# Copy shared packages
COPY packages/ ./packages/

# Copy the target service
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Development
# For local development with hot reload.
# ---------------------------------------------------------------------------
FROM base AS development

# Build shared packages for development
RUN pnpm --filter @swim-nexus/shared-types build && \
    pnpm --filter @swim-nexus/utils build

# Expose default port
EXPOSE 3001

# Start in development mode with hot reload
CMD ["sh", "-c", "pnpm --filter ./services/${SERVICE_NAME} dev"]

# ---------------------------------------------------------------------------
# Stage 3: Builder
# Builds production artefacts.
# ---------------------------------------------------------------------------
FROM base AS builder

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

# Accept the service name as a build argument
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

WORKDIR /app

# Copy workspace configuration files first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.json ./

# Copy shared packages
COPY packages/ ./packages/

# Copy the target service
COPY services/${SERVICE_NAME}/ ./services/${SERVICE_NAME}/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Build shared packages first, then the target service
RUN pnpm --filter @swim-nexus/shared-types build && \
    pnpm --filter @swim-nexus/utils build && \
    pnpm --filter ./services/${SERVICE_NAME} build

# Prune devDependencies for a leaner production install
RUN pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
# Stage 2: Production
# Minimal runtime image with only production artefacts.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production

# Install pnpm (needed to resolve workspace dependencies at runtime)
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
ENV NODE_ENV=production

WORKDIR /app

# Copy workspace config (pnpm needs these to resolve workspace: protocol)
COPY --from=builder /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./

# Copy built shared packages
COPY --from=builder /app/packages/ ./packages/

# Copy built service and its production node_modules
COPY --from=builder /app/services/${SERVICE_NAME}/dist ./services/${SERVICE_NAME}/dist
COPY --from=builder /app/services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/${SERVICE_NAME}/node_modules ./services/${SERVICE_NAME}/node_modules

# Create a non-root user for security
RUN addgroup --system --gid 1001 swimly && \
    adduser --system --uid 1001 swimly
USER swimly

# Default port (overridden per service via environment variables)
EXPOSE 3001

# Health check: hit the service root to verify it is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/api || exit 1

# Start the service
CMD ["sh", "-c", "node services/${SERVICE_NAME}/dist/main.js"]
