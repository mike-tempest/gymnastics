#!/bin/bash

set -e

echo "🏊 Setting up SwimNexus UK development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    echo "Please install Docker from https://www.docker.com/"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm not installed${NC}"
    echo "Please install pnpm: npm install -g pnpm"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${NC}"
    echo -e "${YELLOW}⚠️  Please review .env and update with your configuration${NC}"
else
    echo -e "${GREEN}✓ .env already exists${NC}"
fi
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
until docker exec swim-nexus-db pg_isready -U postgres > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ PostgreSQL failed to start${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
echo ""

# Wait for Redis
echo "⏳ Waiting for Redis to be ready..."
max_attempts=30
attempt=0
until docker exec swim-nexus-redis redis-cli ping > /dev/null 2>&1; do
    attempt=$((attempt+1))
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Redis failed to start${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ Redis is ready${NC}"
echo ""

# Create MinIO bucket
echo "📦 Setting up MinIO bucket..."
sleep 5 # Wait a bit for MinIO to fully start
docker exec swim-nexus-s3 mc alias set local http://localhost:9000 minioadmin minioadmin > /dev/null 2>&1 || true
docker exec swim-nexus-s3 mc mb local/swim-nexus-files > /dev/null 2>&1 || echo "Bucket already exists"
echo -e "${GREEN}✓ MinIO bucket created${NC}"
echo ""

# Note: Database migrations will be run when services start
# We'll add this once we have the services created
echo -e "${YELLOW}ℹ️  Database migrations will run when you start the services${NC}"
echo ""

echo -e "${GREEN}✅ Development environment ready!${NC}"
echo ""
echo "📝 Access points:"
echo "  - Web App:         http://localhost:3000 (not started yet)"
echo "  - API Gateway:     http://localhost:8000"
echo "  - Kong Admin:      http://localhost:8001"
echo "  - MailHog UI:      http://localhost:8025"
echo "  - MinIO Console:   http://localhost:9001 (minioadmin/minioadmin)"
echo "  - pgAdmin:         http://localhost:5050 (admin@swimnexus.com/admin)"
echo "  - PostgreSQL:      localhost:5432 (postgres/postgres)"
echo "  - Redis:           localhost:6379"
echo ""
echo "🚀 Next steps:"
echo "  1. Run 'pnpm dev' to start all services"
echo "  2. Visit http://localhost:3000 in your browser"
echo ""
