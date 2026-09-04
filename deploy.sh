#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Swimly - Deploy All Services to Fly.io
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - Fly CLI installed (https://fly.io/docs/hands-on/install-flyctl/)
#   - Authenticated via `fly auth login`
#   - Apps already created on Fly.io (swimly-web, swimly-membership)
#
# This script sets secrets and deploys each Swimly service in turn.
# =============================================================================

echo "==> Deploying Swimly services to Fly.io..."

# -----------------------------------------------------------------------------
# 1. swimly-web (Next.js front end)
# -----------------------------------------------------------------------------

# Set secrets for the web app (fill in the values before running)
fly secrets set --app swimly-web \
  DATABASE_URL="" \
  NEXTAUTH_SECRET="" \
  NEXTAUTH_URL=""

echo "==> Deploying swimly-web..."
fly deploy --config fly.toml

# -----------------------------------------------------------------------------
# 2. swimly-membership (NestJS membership service)
# -----------------------------------------------------------------------------

# Set secrets for the membership service (fill in the values before running)
fly secrets set --app swimly-membership \
  DATABASE_URL="" \
  JWT_SECRET="" \
  SMTP_HOST="" \
  SMTP_PORT="" \
  SMTP_USER="" \
  SMTP_PASS=""

echo "==> Deploying swimly-membership..."
fly deploy --config fly.membership.toml

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo ""
echo "All Swimly services deployed successfully!"
