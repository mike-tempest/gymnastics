# Swimly Deployment Guide

This guide covers deploying Swimly to a staging/production environment.

## Prerequisites

- **Vercel Account:** Sign up at [vercel.com](https://vercel.com)
- **Vercel CLI:** Installed globally (`npm i -g vercel`)
- **PostgreSQL Database:** Hosted database (see options below)
- **Node.js:** 20+ LTS
- **pnpm:** 8.15+

## Architecture Overview

Swimly is a monorepo with:
- **Frontend:** Next.js 14 web app (apps/web)
- **Backend:** 5 NestJS microservices (services/*)
- **Database:** PostgreSQL 16

For staging, we deploy:
1. Next.js web app to Vercel
2. Backend services to a container platform (Render, Railway, or Fly.io)
3. PostgreSQL to a managed database provider

## Part 1: Deploy Next.js Web App to Vercel

### Step 1: Authenticate with Vercel

```bash
vercel login
```

This will open your browser to authenticate. Choose your preferred login method (GitHub, GitLab, Bitbucket, or email).

### Step 2: Deploy from the Web App Directory

```bash
cd apps/web
vercel --prod
```

The CLI will ask a few questions:
- **Set up and deploy?** Yes
- **Which scope?** Choose your account or team
- **Link to existing project?** No (first time) or Yes (subsequent deploys)
- **Project name?** swimly-staging (or your preferred name)
- **Directory?** Press Enter (use current directory)
- **Override settings?** No (use vercel.json configuration)

### Step 3: Note Your Deployment URL

After deployment completes, Vercel will provide a URL like:
```
https://swimly-staging-abc123.vercel.app
```

Save this URL - you'll need it for environment variables.

## Part 2: Set Up PostgreSQL Database

Choose one of these hosted PostgreSQL providers:

### Option A: Neon (Recommended)

**Pros:** Generous free tier, instant setup, branch-per-PR support  
**Cons:** US/EU regions only

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project: "swimly-staging"
3. Note your connection string:
   ```
   postgresql://user:password@ep-example-123456.region.aws.neon.tech/swimly?sslmode=require
   ```

### Option B: Supabase

**Pros:** Generous free tier, includes auth and storage  
**Cons:** Slightly slower than Neon

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project: "swimly-staging"
3. Go to Settings → Database
4. Copy the "Connection string" (URI format)

### Option C: Railway

**Pros:** Simple, includes deployment for backend services  
**Cons:** Less generous free tier

1. Sign up at [railway.app](https://railway.app)
2. Create a new project
3. Add a PostgreSQL database
4. Copy the connection string from "Connect" tab

### Option D: Render

**Pros:** UK/EU regions available, free tier  
**Cons:** Slower free-tier databases

1. Sign up at [render.com](https://render.com)
2. Create a new PostgreSQL database
3. Choose "Free" plan
4. Copy the "External Database URL"

## Part 3: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add the following variables:

### Required Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend-url.com` | Backend API base URL (or use localhost:3001 for frontend-only testing) |
| `NEXTAUTH_SECRET` | Generate with `openssl rand -base64 32` | Required for NextAuth.js |
| `NEXTAUTH_URL` | `https://swimly-staging-abc123.vercel.app` | Your Vercel deployment URL |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string from Part 2 |

### Optional Variables (for full functionality)

| Variable | Value | Notes |
|----------|-------|-------|
| `JWT_SECRET` | Generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | For API authentication |
| `GOCARDLESS_ACCESS_TOKEN` | Your GoCardless token | For payment processing |
| `GOCARDLESS_ENVIRONMENT` | `sandbox` or `live` | Use sandbox for testing |

4. Click **Save** for each variable
5. Redeploy your application:
   ```bash
   cd apps/web
   vercel --prod
   ```

## Part 4: Seed the Database

Once your database is set up and Vercel deployment is live:

### Option 1: Seed via Local Connection

```bash
# From project root
export DATABASE_URL="postgresql://your-connection-string"
cd services/membership
pnpm install
pnpm build
pnpm run migration:run  # If using TypeORM
node ../../scripts/seed.js  # Run seed script
```

### Option 2: Seed via API Route (if implemented)

```bash
curl -X POST https://swimly-staging-abc123.vercel.app/api/seed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-admin-token"
```

## Part 5: Deploy Backend Services (Optional)

The Next.js app can run standalone with mock data, but for full functionality, deploy the backend services.

### Recommended: Deploy to Railway

1. Connect Railway to your GitHub repository
2. Create 5 services (one for each microservice):
   - `membership-service` (services/membership)
   - `finance-service` (services/finance)
   - `competition-service` (services/competition)
   - `performance-service` (services/performance)
   - `communications-service` (services/communications)
3. Set environment variables for each service
4. Update `NEXT_PUBLIC_API_URL` in Vercel to point to your Railway services

### Alternative: Deploy to Render

1. Create a Blueprint (render.yaml):
```yaml
services:
  - type: web
    name: swimly-membership
    env: node
    buildCommand: cd services/membership && pnpm install && pnpm build
    startCommand: cd services/membership && pnpm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        generateValue: true
```

2. Connect to GitHub and deploy

## Verification Checklist

After deployment, verify:

- [ ] Web app loads at Vercel URL
- [ ] Login/authentication works
- [ ] Can view swimmers list (may be empty initially)
- [ ] Can view families list
- [ ] Can view squads
- [ ] Database connection is successful
- [ ] Environment variables are set correctly

## Troubleshooting

### Build Fails with "Module not found"

**Issue:** Turborepo workspace dependencies not resolving  
**Solution:** Ensure `buildCommand` in vercel.json installs from root:
```json
"buildCommand": "cd ../.. && pnpm install && cd apps/web && pnpm build"
```

### "Invalid JWT Secret" or Auth Errors

**Issue:** NEXTAUTH_SECRET not set or NEXTAUTH_URL incorrect  
**Solution:** Regenerate secret and ensure URL matches deployment:
```bash
openssl rand -base64 32
```

### Database Connection Timeout

**Issue:** DATABASE_URL incorrect or database not accessible  
**Solution:**
- Verify connection string format
- Ensure SSL mode is set: `?sslmode=require`
- Check database provider status
- Whitelist Vercel IPs if required (most providers allow all by default)

### "Cannot find module '@club-manager/shared-types'"

**Issue:** Monorepo packages not built  
**Solution:** Update vercel.json to build from root with Turborepo:
```json
"buildCommand": "cd ../.. && pnpm install && pnpm build --filter=web"
```

### Frontend Shows "API Error" or Mock Data

**Issue:** Backend services not deployed or NEXT_PUBLIC_API_URL incorrect  
**Solution:**
- Verify `NEXT_PUBLIC_API_URL` points to your backend
- Check backend service health
- For staging without backend, the app gracefully falls back to mock data

## Continuous Deployment

### Automatic Deploys

Vercel automatically deploys:
- **Production:** Pushes to `main` branch
- **Preview:** Pull requests (each PR gets a unique URL)

### Manual Deploys

```bash
# Deploy to production
cd apps/web && vercel --prod

# Deploy preview
cd apps/web && vercel
```

## Custom Domain (Optional)

1. Go to Vercel project → **Settings → Domains**
2. Add your domain: `staging.swimly.app`
3. Configure DNS:
   - **A Record:** `76.76.21.21`
   - **CNAME:** `cname.vercel-dns.com`
4. Wait for DNS propagation (5-30 minutes)

## Monitoring and Logs

- **Vercel Logs:** Project → **Logs** tab
- **Error Tracking:** Consider Sentry (free tier)
- **Uptime Monitoring:** Consider UptimeRobot or Better Stack

## Rollback

If a deployment breaks:
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback swimly-staging-abc123.vercel.app
```

## Security Checklist

Before going to production:
- [ ] Change all default secrets
- [ ] Enable HTTPS only (Vercel does this automatically)
- [ ] Set up proper CORS origins
- [ ] Review and test authentication flows
- [ ] Enable Vercel's password protection for staging
- [ ] Set up proper environment variable separation (staging vs production)

## Cost Estimates (Free Tiers)

- **Vercel:** Free for hobby projects, £20/month for teams
- **Neon:** Free tier: 3GB storage, 100 hours compute
- **Supabase:** Free tier: 500MB database, 2GB bandwidth
- **Railway:** £5/month credit, then pay-as-you-go
- **Render:** Free tier with limitations (spins down after 15 min inactivity)

## Next Steps

1. Deploy backend services to Railway/Render
2. Set up CI/CD pipeline with GitHub Actions
3. Configure custom domain
4. Set up monitoring and error tracking
5. Create separate production environment

## Support

For deployment issues:
- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Neon Docs:** [neon.tech/docs](https://neon.tech/docs)
- **Project Issues:** [GitHub Issues](https://github.com/your-repo/issues)
