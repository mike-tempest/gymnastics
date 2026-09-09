# Technology Stack Decisions

This document explains the key technology choices for SwimNexus UK and the rationale behind them.

## Overview

| Layer             | Technology                  | Justification                                      |
| ----------------- | --------------------------- | -------------------------------------------------- |
| **Web Frontend**  | Next.js 14 (App Router)     | SSR, SEO, API routes, production-ready             |
| **Mobile**        | Flutter 3.19+               | Single codebase, offline-first, native performance |
| **Backend**       | NestJS (Node.js/TypeScript) | Microservices support, shared language, DI pattern |
| **API Gateway**   | Kong Gateway                | Production-ready, plugin ecosystem, self-hosted    |
| **Database**      | PostgreSQL 16               | JSONB, RLS, time-series, ACID compliance           |
| **Cache**         | Redis 7                     | Session storage, pub/sub, rate limiting            |
| **File Storage**  | AWS S3                      | Scalable, secure, video storage                    |
| **Message Queue** | Redis (Bull/BullMQ)         | Job scheduling, background tasks                   |
| **Monitoring**    | Prometheus + Grafana        | Open-source, K8s native                            |

---

## Frontend: Next.js vs React + Vite

### Why Next.js 14?

**✅ Chosen: Next.js 14 with App Router**

**Key Advantages:**

1. **Server-Side Rendering (SSR)**
   - Better SEO for public-facing pages (club websites, meet results)
   - Faster initial page loads
   - Critical for admin dashboards with large data tables

2. **API Routes (Backend-for-Frontend)**

   ```typescript
   // app/api/swimmers/route.ts
   export async function GET(request: Request) {
     const session = await getServerSession();
     const swimmers = await fetchSwimmers(session.clubId);
     return Response.json(swimmers);
   }
   ```

   - Simplifies authentication flow
   - No CORS issues
   - Type-safe API calls with tRPC integration

3. **File-Based Routing**

   ```
   app/
   ├── (auth)/
   │   ├── login/page.tsx
   │   └── register/page.tsx
   ├── (dashboard)/
   │   ├── layout.tsx          # Shared dashboard layout
   │   ├── swimmers/page.tsx
   │   ├── finance/page.tsx
   │   └── competitions/page.tsx
   └── api/
       └── [...routes]/
   ```

   - Intuitive structure
   - Automatic code splitting
   - Layout nesting

4. **Server Components (React 18)**
   - Reduce JavaScript bundle size
   - Fetch data on server (better security for API keys)
   - Streaming UI with Suspense

5. **Image Optimization**

   ```tsx
   <Image src="/swimmer-photo.jpg" width={400} height={300} alt="Swimmer" priority />
   ```

   - Automatic WebP conversion
   - Lazy loading
   - Responsive images

6. **Production-Ready**
   - Used by Vercel, Hulu, TikTok, Nike, Twitch
   - Built-in analytics
   - Edge functions support (Vercel Edge, Cloudflare Workers)

7. **Developer Experience**
   - Fast Refresh (hot module reload)
   - TypeScript first-class support
   - Excellent documentation

**❌ Why NOT Vite + React?**

While Vite is excellent for SPAs:

- **No built-in SSR:** Requires manual setup (Vite-SSR, vike)
- **No API routes:** Need separate backend or serverless functions
- **SEO challenges:** Client-side rendering only
- **More configuration:** Routing, auth, data fetching all manual
- **Less opinionated:** More decisions = more bikeshedding

**Use Case Fit:**

- SwimNexus web app is a **data-intensive admin portal**
- Need **fast page loads** for treasurers/secretaries (not tech-savvy)
- **SEO matters** for public club pages (future feature)
- **SSR** critical for performance on large tables (invoices, swimmer lists)

---

## Mobile: Flutter vs React Native

### Why Flutter?

**✅ Chosen: Flutter 3.19+**

**Key Advantages:**

1. **Offline-First Support**
   - Drift (SQLite) for local database
   - Excellent sync libraries (Hive, Isar)
   - Critical for poolside usage (no cellular signal)

2. **Single Codebase**
   - iOS + Android from one source
   - 95% code reuse
   - Faster feature delivery

3. **Performance**
   - Compiled to native ARM code
   - Smooth 60fps animations
   - No JavaScript bridge overhead

4. **UI Consistency**
   - Material Design + Cupertino widgets
   - Looks native on both platforms
   - Custom design system easy to implement

5. **Developer Experience**
   - Hot reload (sub-second)
   - Strong typing (Dart)
   - Excellent tooling (DevTools, Flutter Inspector)

**❌ Why NOT React Native?**

- **Offline support:** More complex (AsyncStorage + custom sync)
- **Performance:** JavaScript bridge can be bottleneck
- **Native modules:** Often requires platform-specific code
- **Team skill:** Dart easier to learn than JavaScript nuances

---

## Backend: NestJS vs Alternatives

### Why NestJS (Node.js/TypeScript)?

**✅ Chosen: NestJS 10+**

**Key Advantages:**

1. **Shared Language**

   ```typescript
   // Backend
   export class CreateSwimmerDto {
     @IsString()
     first_name: string;
   }

   // Frontend (Next.js)
   import { CreateSwimmerDto } from '@club-manager/shared-types';
   const swimmer: CreateSwimmerDto = { ... };
   ```

   - TypeScript across backend, web, and shared packages
   - Single mental model for team

2. **Microservices Support**

   ```typescript
   @Controller('swimmers')
   export class SwimmersController {
     @Get()
     async findAll(@CurrentUser() user: User) {
       return this.swimmersService.findByClub(user.clubId);
     }
   }
   ```

   - Built-in microservices architecture
   - Dependency injection
   - Modular structure

3. **Ecosystem**
   - TypeORM for PostgreSQL
   - Bull for job queues
   - Passport for authentication
   - Swagger for API docs (auto-generated)

4. **Performance**
   - Non-blocking I/O
   - Event-driven architecture
   - Handles 10k+ RPS easily (V8 engine)

5. **Developer Availability**
   - Large UK talent pool
   - Lower hiring costs vs Go/Rust
   - Faster onboarding

**Alternatives Considered:**

**Python (FastAPI)**

- **Pros:** Excellent for data science, ML (future nutrition/performance features)
- **Cons:** Type system less mature, slower startup, no shared types with frontend
- **Verdict:** Great for specialized services, but not primary backend

**Go**

- **Pros:** Superior performance, built-in concurrency
- **Cons:** Smaller talent pool, slower development, verbose error handling
- **Verdict:** Overkill for current scale (50-300 clubs)

**Rust**

- **Pros:** Memory safety, blazing performance
- **Cons:** Steep learning curve, small ecosystem, slow compilation
- **Verdict:** Too niche for startup timeline

---

## Database: PostgreSQL vs Alternatives

### Why PostgreSQL 16?

**✅ Chosen: PostgreSQL 16**

**Key Advantages:**

1. **JSONB Support**

   ```sql
   -- Flexible club configuration
   SELECT * FROM clubs WHERE config->>'payment_gateway' = 'gocardless';

   -- Update nested fields
   UPDATE clubs SET config = jsonb_set(config, '{features,video_analysis}', 'true');
   ```

   - Store workout JSON, club settings, consent flags
   - Query JSON with indexes
   - Schema flexibility

2. **Row-Level Security (Multi-Tenancy)**

   ```sql
   CREATE POLICY club_isolation ON swimmers
     USING (club_id = current_setting('app.current_club_id')::uuid);
   ```

   - Data isolation per club
   - Enforced at database level
   - No accidental cross-club data leaks

3. **Full-Text Search**

   ```sql
   SELECT * FROM swimmers
   WHERE to_tsvector('english', first_name || ' ' || last_name)
     @@ to_tsquery('emma');
   ```

   - Search swimmers, meets, events
   - No need for Elasticsearch initially

4. **Time-Series Support**
   - Table partitioning for wellness logs
   - TimescaleDB extension (future)
   - Efficient queries on training data

5. **ACID Compliance**
   - Critical for financial transactions
   - GoCardless payment reconciliation
   - Invoice generation

6. **UK Hosting**
   - AWS RDS eu-west-2 (London)
   - GDPR compliance (data residency)

**Alternatives Considered:**

**MySQL/MariaDB**

- **Cons:** Weaker JSON support, no RLS, licensing concerns (MySQL)

**MongoDB**

- **Cons:** No ACID transactions (critical for finance), no joins (complex queries)

**Supabase (PostgreSQL + Realtime)**

- **Pros:** Realtime subscriptions, built-in auth
- **Cons:** Vendor lock-in, less control, pricing unpredictable at scale

---

## API Gateway: Kong vs Alternatives

### Why Kong Gateway?

**✅ Chosen: Kong Gateway (OSS)**

**Key Advantages:**

1. **Plugin Ecosystem**
   - Rate limiting
   - JWT authentication
   - Request transformation
   - Logging/monitoring
   - All out-of-box

2. **Declarative Configuration**

   ```yaml
   services:
     - name: membership-service
       url: http://membership:3000
       routes:
         - name: swimmers
           paths:
             - /api/v1/swimmers
           plugins:
             - name: jwt
             - name: rate-limiting
               config:
                 minute: 100
   ```

   - Infrastructure as code
   - Version controlled
   - Easy to replicate environments

3. **Production-Ready**
   - Battle-tested (Nasdaq, Expedia, Samsung)
   - Scales horizontally
   - Self-hosted (no vendor lock-in)

4. **Performance**
   - Nginx-based
   - Handles 10k+ RPS
   - Low latency overhead

**Alternatives Considered:**

**AWS API Gateway**

- **Cons:** Vendor lock-in, cost unpredictable, local dev complex

**Traefik**

- **Cons:** Less API-focused, fewer plugins, primarily for Docker/K8s

**Express Gateway**

- **Cons:** Less mature, smaller community, fewer features

---

## File Storage: AWS S3 vs Alternatives

### Why AWS S3?

**✅ Chosen: AWS S3 (MinIO for local dev)**

**Key Advantages:**

1. **Scalability**
   - Unlimited storage
   - Auto-scaling
   - 99.999999999% durability

2. **Security**
   - Server-side encryption (SSE-S3)
   - IAM policies
   - Versioning for audit compliance

3. **Cost-Effective**
   - Pay-per-use
   - Lifecycle policies (archive to Glacier)
   - ~£0.02/GB/month

4. **Video Storage**
   - Stroke analysis videos
   - Meet recordings
   - CloudFront CDN integration

5. **MinIO Compatibility**
   ```typescript
   // Same API for local dev and production
   const s3Client = new S3Client({
     endpoint: process.env.S3_ENDPOINT, // http://minio:9000 or AWS
     credentials: { ... }
   });
   ```

**Alternatives Considered:**

**Cloudflare R2**

- **Pros:** No egress fees
- **Cons:** Newer service, less mature

**DigitalOcean Spaces**

- **Pros:** Simpler pricing
- **Cons:** Smaller network, fewer regions

---

## Caching: Redis vs Alternatives

### Why Redis 7?

**✅ Chosen: Redis 7**

**Key Advantages:**

1. **Multiple Use Cases**
   - Session storage (JWT refresh tokens)
   - Rate limiting
   - Pub/sub for real-time notifications
   - Job queues (Bull/BullMQ)
   - Cache frequently accessed data

2. **Performance**
   - Sub-millisecond latency
   - In-memory storage
   - Handles 100k+ ops/sec

3. **Data Structures**

   ```typescript
   // Rate limiting with sorted sets
   await redis.zadd(`rate-limit:${userId}`, Date.now(), requestId);
   const count = await redis.zcount(`rate-limit:${userId}`, oneHourAgo, now);
   ```

   - Sorted sets, hashes, lists
   - Atomic operations

4. **Persistence**
   - AOF (append-only file)
   - RDB snapshots
   - Don't lose cache on restart

**Alternatives Considered:**

**Memcached**

- **Cons:** No persistence, simpler data structures, no pub/sub

**DragonflyDB**

- **Pros:** Redis-compatible, faster
- **Cons:** Newer, less battle-tested

---

## Monitoring: Prometheus + Grafana vs Alternatives

### Why Prometheus + Grafana?

**✅ Chosen: Prometheus + Grafana**

**Key Advantages:**

1. **Open Source**
   - No vendor lock-in
   - Self-hosted
   - Free

2. **Kubernetes Native**
   - Service discovery
   - PromQL for queries
   - Scales with infrastructure

3. **Comprehensive**
   - Metrics (Prometheus)
   - Visualization (Grafana)
   - Alerting (Alertmanager)

4. **Ecosystem**
   - NestJS exporters
   - PostgreSQL exporters
   - Redis exporters
   - All out-of-box

**Alternatives Considered:**

**Datadog/New Relic**

- **Cons:** Expensive at scale, vendor lock-in

**AWS CloudWatch**

- **Cons:** AWS-specific, less flexible querying

---

## Summary

Our tech stack prioritizes:

1. **Developer Productivity:** TypeScript everywhere, Next.js conventions
2. **UK Market Fit:** Offline-first mobile, GDPR compliance
3. **Cost Efficiency:** Open-source where possible, pay-per-use cloud
4. **Team Scalability:** Popular technologies with large talent pools
5. **Future-Proof:** Modern, actively maintained, clear upgrade paths

**Total Stack Learning Curve:**

- **Easy:** Next.js, PostgreSQL, Redis (common skills)
- **Medium:** NestJS, Flutter (growing ecosystems)
- **Advanced:** Kong, Prometheus (DevOps-focused)

**Estimated Team Size for Phase 1-3:**

- 2-3 full-stack engineers (TypeScript)
- 1 mobile engineer (Flutter)
- 0.5 DevOps engineer (can outsource initially)

---

**Last Updated:** December 2024
**Review Cycle:** Every 6 months or when significant limitations discovered
