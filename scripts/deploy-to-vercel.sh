#!/bin/bash
set -e

# Swimly Vercel Deployment Script
# This script deploys the Next.js web app to Vercel

echo "🏊 Swimly Vercel Deployment Script"
echo "=================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if authenticated
echo "🔐 Checking Vercel authentication..."
if ! vercel whoami &> /dev/null; then
    echo "⚠️  Not authenticated with Vercel. Please log in:"
    vercel login
fi

# Confirm deployment
echo ""
echo "This will deploy the Swimly web app to Vercel."
read -p "Deploy to PRODUCTION (y/n)? " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Navigate to web app directory
cd "$(dirname "$0")/../apps/web"

echo ""
echo "🚀 Deploying to Vercel..."
echo ""

# Deploy to production
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Note the deployment URL from above"
echo "2. Configure environment variables in Vercel dashboard:"
echo "   - NEXT_PUBLIC_API_URL"
echo "   - NEXTAUTH_SECRET"
echo "   - NEXTAUTH_URL"
echo "   - DATABASE_URL"
echo "3. See DEPLOYMENT.md for full configuration guide"
echo ""
echo "🎉 Done!"
