# Railway Deployment Setup Guide

## Current Status ✅

The following configuration is complete:

### Environment Variables

All required environment variables are configured in the Railway production environment:

- ✅ `DATABASE_URL` - `postgresql://swimly:***@postgresql.railway.internal:5432/swimly`
- ✅ `NODE_ENV=production`
- ✅ `NEXTAUTH_SECRET` - Configured with secure random value
- ✅ `NEXTAUTH_URL` - Set to `https://web-app-production-7a4c.up.railway.app`
- ✅ `MEMBERSHIP_API_URL` - Internal Railway service reference
- ✅ `NEXT_PUBLIC_API_URL` - Public API endpoint

### Build Configuration

- ✅ `railway.toml` configured in `apps/web/`
- ✅ Dockerfile optimised for monorepo deployment
- ✅ Multi-stage build with standalone output
- ✅ Health check configured (`/` endpoint, 300s timeout)
- ✅ Restart policy: `ON_FAILURE` with 3 max retries

## Required Manual Step

### Connect GitHub Repository

The Web App service needs to be connected to the GitHub repository to enable deployments.

**Steps:**

1. Go to Railway dashboard: https://railway.app/project/26c6f28c-d0ab-4555-8c7a-838f3fe3f3ea
2. Select the **production** environment
3. Click on the **Web App** service
4. Go to **Settings** > **Source**
5. Click **Connect Repo**
6. Authorise Railway GitHub App if not already done
7. Select repository: `mike-tempest/swim-team`
8. Set branch: `main`
9. Configure build settings (should auto-detect from railway.toml):
   - Builder: Dockerfile
   - Dockerfile path: `apps/web/Dockerfile`
   - Root directory: `/` (monorepo root)

### Trigger Deployment

Once the repository is connected:

1. Railway should automatically trigger a deployment
2. Or manually click **Deploy** in the service dashboard
3. Monitor the build logs for any errors

### Expected Deployment Flow

1. Railway clones the repository
2. Builds using `apps/web/Dockerfile`
3. Multi-stage build:
   - Install dependencies (pnpm workspace)
   - Build shared packages (@club-manager/shared-types, @club-manager/utils)
   - Build Next.js application
   - Create standalone output
4. Start with `node apps/web/server.js`
5. Health check on port 3000

### Verification

After deployment completes:

1. Check deployment status in Railway dashboard
2. Visit: https://web-app-production-7a4c.up.railway.app
3. Verify the app loads correctly
4. Test authentication flow
5. Check database connectivity

## Railway Service IDs

For reference:

- Project ID: `26c6f28c-d0ab-4555-8c7a-838f3fe3f3ea`
- Production Environment ID: `b3cfcdf2-94b5-4451-b994-25be81a376ce`
- Web App Service ID: `9396cb64-48c5-44f9-b580-e997f78d60cc`
- PostgreSQL Service ID: `940a424f-b45c-444c-878a-d0c33c3537a0`

## Troubleshooting

### Build Failures

- Check build logs in Railway dashboard
- Verify Dockerfile builds locally: `docker build -f apps/web/Dockerfile .` (from repo root)
- Ensure all environment variables are set

### Runtime Errors

- Check service logs in Railway dashboard
- Verify DATABASE_URL is accessible
- Check Next.js build output for errors

### Database Connection Issues

- Ensure PostgreSQL service is running
- Verify DATABASE_URL reference is correct
- Check network policies (should be internal by default)
