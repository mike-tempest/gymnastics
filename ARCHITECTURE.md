# SwimNexus UK - Architecture Overview

**Last Updated:** December 2024
**Architecture Version:** 1.0 (Web-First)

## Decision: Web-First Approach

**We are building everything as a responsive web application using Next.js 14.**

### Why Web-First?

1. **Faster Time to Market**
   - Single codebase for all user types (admin, coach, parent)
   - No app store approval process
   - Instant updates (no app store review delays)

2. **Lower Development Cost**
   - One team, one technology stack
   - No need for separate iOS/Android expertise initially
   - Easier to iterate and test

3. **Progressive Web App (PWA) Capability**
   - Install on home screen (mobile)
   - Offline support via Service Workers
   - Push notifications (web push)
   - Camera access for video analysis

4. **Responsive Design**
   - Works on desktop (admin tasks)
   - Works on tablet (coach poolside)
   - Works on mobile (parent quick views)

5. **Future Mobile App**
   - Can add native app later if needed
   - Use Next.js API routes (already built)
   - Data models already proven

### User Experience by Device

| User Role | Primary Device | Use Case |
|-----------|---------------|----------|
| **Treasurer** | Desktop | Financial reports, reconciliation, exports |
| **Competition Secretary** | Desktop | Meet file import, entry management |
| **Head Coach** | Desktop + Tablet | Training plans, performance analytics |
| **Squad Coach** | Tablet/Mobile | Poolside attendance, workout delivery |
| **Parent** | Mobile | View schedule, payments, messages |
| **Swimmer (18+)** | Mobile | View training, log wellness, messages |

**Implementation:** Next.js with Tailwind CSS (mobile-first responsive design)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USERS (Web Browsers)                         │
│  Desktop (Admin) │ Tablet (Coach) │ Mobile (Parent/Swimmer)     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      │ HTTPS
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                   NEXT.JS APPLICATION                            │
│                    (Port 3000)                                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Server       │  │ API Routes   │  │ Client       │          │
│  │ Components   │  │ (BFF Pattern)│  │ Components   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                   │                  │
│         └─────────────────┼───────────────────┘                  │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                      KONG API GATEWAY                            │
│                        (Port 8000)                               │
│  Authentication │ Rate Limiting │ Routing │ Logging              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  Membership    │  │    Finance     │  │  Competition   │
│   Service      │  │    Service     │  │    Service     │
│  (Port 3001)   │  │  (Port 3002)   │  │  (Port 3003)   │
└───────┬────────┘  └───────┬────────┘  └───────┬────────┘
        │                   │                    │
┌───────▼────────┐  ┌───────▼────────┐          │
│  Performance   │  │ Communications │          │
│    Service     │  │    Service     │          │
│  (Port 3004)   │  │  (Port 3005)   │          │
└───────┬────────┘  └───────┬────────┘          │
        │                   │                    │
        └───────────────────┼────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│  PostgreSQL    │  │     Redis      │  │    AWS S3      │
│  (Port 5432)   │  │  (Port 6379)   │  │   (MinIO)      │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Next.js Application Structure

### App Router Layout

```
apps/web/
├── app/
│   ├── (auth)/                    # Authentication pages (no dashboard layout)
│   │   ├── login/
│   │   │   └── page.tsx           # Login page
│   │   ├── register/
│   │   │   └── page.tsx           # Club registration
│   │   └── layout.tsx             # Auth layout (centered, no sidebar)
│   │
│   ├── (dashboard)/               # Main application (with sidebar)
│   │   ├── layout.tsx             # Dashboard layout (sidebar, header)
│   │   │
│   │   ├── page.tsx               # Dashboard home
│   │   │
│   │   ├── membership/            # Membership module
│   │   │   ├── families/
│   │   │   │   ├── page.tsx       # Families list
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx   # Family details
│   │   │   │   └── new/
│   │   │   │       └── page.tsx   # Create family
│   │   │   ├── swimmers/
│   │   │   │   ├── page.tsx       # Swimmers list
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx   # Swimmer profile
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   └── squads/
│   │   │       ├── page.tsx
│   │   │       └── [id]/page.tsx
│   │   │
│   │   ├── finance/               # Finance module
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx       # Invoices list
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── payments/
│   │   │   │   └── page.tsx
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx       # Billing settings
│   │   │
│   │   ├── competitions/          # Competition module
│   │   │   ├── meets/
│   │   │   │   ├── page.tsx       # Meets list
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx   # Meet details
│   │   │   │   │   ├── entries/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── results/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── import/
│   │   │   │       └── page.tsx   # Import meet file
│   │   │   └── pbs/
│   │   │       └── page.tsx       # Personal bests
│   │   │
│   │   ├── training/              # Performance module
│   │   │   ├── sessions/
│   │   │   │   ├── page.tsx       # Sessions calendar
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx   # Session detail + attendance
│   │   │   │   └── new/
│   │   │   │       └── page.tsx   # Create session
│   │   │   ├── workouts/
│   │   │   │   ├── page.tsx       # Workout library
│   │   │   │   └── builder/
│   │   │   │       └── page.tsx   # Workout builder
│   │   │   ├── analytics/
│   │   │   │   ├── page.tsx       # Squad analytics
│   │   │   │   └── [swimmerId]/
│   │   │   │       └── page.tsx   # Swimmer analytics
│   │   │   └── wellness/
│   │   │       └── page.tsx       # Wellness dashboard
│   │   │
│   │   ├── communications/        # Communications module
│   │   │   ├── messages/
│   │   │   │   ├── page.tsx       # Inbox
│   │   │   │   └── compose/
│   │   │   │       └── page.tsx
│   │   │   ├── calendar/
│   │   │   │   └── page.tsx
│   │   │   └── documents/
│   │   │       └── page.tsx
│   │   │
│   │   ├── compliance/            # Compliance module (Welfare Officer)
│   │   │   ├── dbs/
│   │   │   │   └── page.tsx
│   │   │   ├── consents/
│   │   │   │   └── page.tsx
│   │   │   └── audit-logs/
│   │   │       └── page.tsx
│   │   │
│   │   └── settings/              # Club settings
│   │       ├── page.tsx
│   │       ├── users/
│   │       │   └── page.tsx
│   │       └── permissions/
│   │           └── page.tsx
│   │
│   ├── (parent)/                  # Parent portal (simplified layout)
│   │   ├── layout.tsx             # Parent-specific layout
│   │   ├── page.tsx               # Parent dashboard
│   │   ├── children/
│   │   │   └── [id]/
│   │   │       ├── schedule/
│   │   │       │   └── page.tsx
│   │   │       └── progress/
│   │   │           └── page.tsx
│   │   ├── payments/
│   │   │   └── page.tsx
│   │   └── messages/
│   │       └── page.tsx
│   │
│   ├── api/                       # API Routes (Backend-for-Frontend)
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── route.ts
│   │   │   ├── logout/
│   │   │   │   └── route.ts
│   │   │   └── refresh/
│   │   │       └── route.ts
│   │   ├── swimmers/
│   │   │   ├── route.ts           # GET /api/swimmers, POST /api/swimmers
│   │   │   └── [id]/
│   │   │       ├── route.ts       # GET/PUT/DELETE /api/swimmers/:id
│   │   │       └── photo/
│   │   │           └── route.ts   # POST /api/swimmers/:id/photo
│   │   ├── invoices/
│   │   │   └── route.ts
│   │   ├── meets/
│   │   │   ├── import/
│   │   │   │   └── route.ts       # POST /api/meets/import (file upload)
│   │   │   └── [id]/
│   │   │       └── entries/
│   │   │           └── route.ts
│   │   └── webhooks/
│   │       ├── gocardless/
│   │       │   └── route.ts       # GoCardless webhooks
│   │       └── stripe/
│   │           └── route.ts       # Stripe webhooks
│   │
│   ├── layout.tsx                 # Root layout
│   ├── globals.css                # Global styles
│   └── not-found.tsx              # 404 page
│
├── components/                    # Shared React components
│   ├── ui/                        # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── forms/
│   │   ├── swimmer-form.tsx
│   │   ├── invoice-form.tsx
│   │   └── ...
│   ├── layouts/
│   │   ├── dashboard-sidebar.tsx
│   │   ├── dashboard-header.tsx
│   │   └── parent-navbar.tsx
│   └── tables/
│       ├── swimmers-table.tsx
│       ├── invoices-table.tsx
│       └── ...
│
├── lib/                           # Utilities and helpers
│   ├── api/
│   │   ├── client.ts              # API client (fetch wrapper)
│   │   ├── swimmers.ts            # Swimmer API functions
│   │   ├── invoices.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── use-auth.ts            # Authentication hook
│   │   ├── use-club.ts            # Club context hook
│   │   └── use-permissions.ts     # Permission checking
│   ├── utils/
│   │   ├── cn.ts                  # classnames utility
│   │   ├── format.ts              # Date/currency formatters
│   │   └── validation.ts          # Client-side validation
│   └── auth/
│       ├── next-auth.ts           # NextAuth configuration
│       └── permissions.ts         # Permission definitions
│
├── public/                        # Static assets
│   ├── images/
│   ├── icons/
│   └── manifest.json              # PWA manifest
│
├── .env.local                     # Environment variables
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json
```

### Key Next.js Features Used

1. **App Router** (Next.js 14)
   - File-based routing
   - Server Components by default
   - Nested layouts
   - Route groups `(dashboard)`, `(auth)`, `(parent)`

2. **Server Components**
   ```tsx
   // app/(dashboard)/swimmers/page.tsx
   export default async function SwimmersPage() {
     // Fetch on server
     const swimmers = await fetchSwimmers();

     return <SwimmersTable swimmers={swimmers} />;
   }
   ```
   - Faster page loads
   - Less JavaScript sent to client
   - Direct database queries (via API routes)

3. **API Routes (Backend-for-Frontend)**
   ```tsx
   // app/api/swimmers/route.ts
   export async function GET(request: Request) {
     const session = await getServerSession();

     // Call backend microservice
     const response = await fetch(`${process.env.API_URL}/api/v1/swimmers`, {
       headers: {
         'Authorization': `Bearer ${session.accessToken}`,
       },
     });

     return Response.json(await response.json());
   }
   ```
   - Proxy to backend services
   - Handle authentication
   - Transform data
   - No CORS issues

4. **Server Actions** (for mutations)
   ```tsx
   // app/(dashboard)/swimmers/actions.ts
   'use server'

   export async function createSwimmer(formData: FormData) {
     const session = await getServerSession();

     const response = await fetch(`${process.env.API_URL}/api/v1/swimmers`, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${session.accessToken}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         first_name: formData.get('first_name'),
         last_name: formData.get('last_name'),
         // ...
       }),
     });

     revalidatePath('/swimmers');
     return await response.json();
   }
   ```

5. **Parallel Routes & Intercepting Routes**
   - Modal overlays for quick actions
   - Multi-panel views (e.g., inbox + message detail)

6. **Progressive Web App (PWA)**
   ```json
   // public/manifest.json
   {
     "name": "SwimNexus UK",
     "short_name": "SwimNexus",
     "description": "The Operating System for British Swimming Clubs",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#0066cc",
     "icons": [...]
   }
   ```
   - Installable on mobile home screen
   - Offline support via Service Worker
   - Push notifications

---

## Backend Microservices Architecture

### Service Responsibilities

| Service | Port | Responsibilities |
|---------|------|------------------|
| **Membership** | 3001 | Clubs, families, swimmers, squads, DBS, consents, users, permissions |
| **Finance** | 3002 | Invoices, payments, GoCardless, Stripe, billing engine, reconciliation |
| **Competition** | 3003 | Meets, events, entries, results, PBs, file parsers (.hy3, .sex), volunteers |
| **Performance** | 3004 | Training sessions, workouts, attendance, RPE, ACWR, wellness, wearables, CSS |
| **Communications** | 3005 | Messages, notifications (push/email/SMS), calendar, documents |

### Service Communication

**Services communicate via:**
1. **HTTP/REST** for synchronous requests
2. **Redis Pub/Sub** for events (e.g., "swimmer_created" → update welcome email)
3. **Shared Database** (same PostgreSQL, different schemas) - *acceptable for monolith-first approach*

**Future:** Move to message queue (RabbitMQ/Kafka) if needed.

### NestJS Service Structure

Each service follows identical structure:

```
services/membership/
├── src/
│   ├── main.ts                    # Bootstrap
│   ├── app.module.ts              # Root module
│   ├── config/                    # Configuration
│   ├── modules/
│   │   ├── swimmers/
│   │   │   ├── swimmers.module.ts
│   │   │   ├── swimmers.controller.ts
│   │   │   ├── swimmers.service.ts
│   │   │   ├── swimmers.repository.ts
│   │   │   ├── dto/               # Data Transfer Objects
│   │   │   └── entities/          # TypeORM entities
│   │   ├── families/
│   │   └── squads/
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── common/                    # Shared guards, decorators, etc.
│   └── utils/
├── test/
├── Dockerfile
└── package.json
```

---

## Data Layer

### PostgreSQL Database

**Multi-Tenancy Strategy:** Row-Level Security (RLS)

Every table has `club_id` column:

```sql
-- Enable RLS
ALTER TABLE swimmers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their club's data
CREATE POLICY club_isolation ON swimmers
  USING (club_id = current_setting('app.current_club_id')::uuid);

-- Application sets club context per request
SET app.current_club_id = 'club-uuid';
```

### Core Tables

```sql
-- Clubs
clubs (club_id, name, se_affiliation_number, config_jsonb, created_at)

-- Membership
families (family_id, club_id, primary_contact_id, billing_reference)
guardians (guardian_id, family_id, email, phone, is_primary)
swimmers (swimmer_id, family_id, club_id, se_number, first_name, last_name, dob, gender, squad_id)
squads (squad_id, club_id, name, fee_monthly, max_capacity)

-- Finance
invoices (invoice_id, family_id, club_id, amount, due_date, status)
invoice_lines (line_id, invoice_id, description, amount, type)
payments (payment_id, invoice_id, amount, date, method, reference, status)

-- Competition
meets (meet_id, club_id, name, date, venue, course, import_file_blob)
events (event_id, meet_id, event_code, distance, stroke, gender, age_group)
entries (entry_id, meet_id, swimmer_id, event_id, entry_time, status)
results (result_id, entry_id, final_time, place, splits_json)
personal_bests (pb_id, swimmer_id, event_code, course, time, date, meet_id)

-- Performance
training_sessions (session_id, squad_id, club_id, date, workout_json)
attendance_logs (log_id, session_id, swimmer_id, attended, rpe, notes)
wellness_logs (log_id, swimmer_id, date, sleep_quality, fatigue, mood, stress)

-- Communications
messages (message_id, club_id, sender_id, channel_type, subject, body)
message_recipients (recipient_id, message_id, user_id, read_at)

-- Compliance
dbs_records (record_id, person_id, club_id, certificate_number, issue_date, expiry_date)
consents (consent_id, swimmer_id, type, granted, date, guardian_id)
audit_logs (log_id, club_id, user_id, action, entity_type, entity_id, metadata_jsonb)
```

### Redis Usage

```
Session Storage:
  Key: session:{sessionId}
  Value: { userId, clubId, role, ... }
  TTL: 30 days

Rate Limiting:
  Key: rate-limit:{userId}:{endpoint}
  Value: Request count
  TTL: 1 hour

Job Queue (BullMQ):
  Queue: billing-jobs
  Queue: email-jobs
  Queue: webhook-jobs

Pub/Sub:
  Channel: events:swimmer_created
  Channel: events:payment_received
```

---

## Authentication & Authorization

### NextAuth.js (Web)

```typescript
// lib/auth/next-auth.ts
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        // Call backend login API
        const response = await fetch(`${process.env.API_URL}/api/v1/auth/login`, {
          method: 'POST',
          body: JSON.stringify(credentials),
        });

        if (response.ok) {
          return await response.json(); // { user, accessToken, refreshToken }
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.clubId = user.clubId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.clubId = token.clubId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
```

### Permission Matrix

Enforced at:
1. **Next.js API Routes** (before calling backend)
2. **Backend Services** (double-check)
3. **UI** (hide unauthorized actions)

```typescript
// lib/auth/permissions.ts
export const PERMISSIONS = {
  SWIMMER_CREATE: ['super_admin', 'head_coach', 'squad_coach'],
  SWIMMER_DELETE: ['super_admin'],
  INVOICE_VIEW: ['super_admin', 'treasurer', 'head_coach'],
  INVOICE_CREATE: ['super_admin', 'treasurer'],
  DBS_VIEW: ['super_admin', 'welfare_officer'],
  // ...
};

export function hasPermission(role: string, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}
```

---

## Deployment Architecture (Production)

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS CloudFront                          │
│                    (CDN + SSL/TLS)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐          ┌───────▼────────┐
│  Next.js App   │          │  Static Assets │
│  (Railway or    │          │    (S3)        │
│   AWS ECS)     │          └────────────────┘
└───────┬────────┘
        │
┌───────▼────────┐
│  Kong Gateway  │
│   (ECS)        │
└───────┬────────┘
        │
┌───────┴───────────────────────┐
│   Microservices (ECS Fargate) │
│ ┌──────┐ ┌──────┐ ┌──────┐   │
│ │ Memb.│ │Finance│ │ Comp.│   │
│ └──────┘ └──────┘ └──────┘   │
└───────┬───────────────────────┘
        │
┌───────┴───────────┐
│  AWS RDS          │
│  (PostgreSQL)     │
│  eu-west-2        │
└───────────────────┘
```

**Hosting Options:**

1. **Next.js App:**
   - **Option A:** Railway (easiest, automatic deployments)
   - **Option B:** AWS ECS Fargate (more control, cheaper at scale)

2. **Microservices:** AWS ECS Fargate
3. **Database:** AWS RDS PostgreSQL (Multi-AZ for HA)
4. **Cache:** AWS ElastiCache for Redis
5. **Files:** AWS S3 + CloudFront CDN

---

## Development Workflow

```bash
# 1. Start infrastructure (Docker)
./scripts/setup-dev-env.sh

# 2. Start all services
pnpm dev

# Access:
# - Next.js: http://localhost:3000
# - API Gateway: http://localhost:8000
# - MailHog: http://localhost:8025
# - MinIO: http://localhost:9001
```

---

## Security Considerations

1. **Authentication:** NextAuth.js with JWT
2. **Authorization:** Role-based access control (RBAC)
3. **Data Isolation:** PostgreSQL Row-Level Security
4. **Encryption:**
   - At rest: AES-256 (RDS encryption)
   - In transit: TLS 1.3
5. **Secrets:** AWS Secrets Manager (production)
6. **API Security:** Rate limiting, CORS, CSRF protection
7. **Compliance:** GDPR, Wavepower 2024 enforced at application level

---

## Scalability Considerations

### Current Architecture (Phase 1-3)

- **Expected Load:** 50-300 clubs, ~50k users
- **Read/Write Ratio:** 80/20
- **Database:** Single RDS instance (sufficient)
- **Caching:** Redis for sessions + frequently accessed data

### Future Scaling (300+ clubs)

1. **Database:**
   - Read replicas for analytics queries
   - Connection pooling (PgBouncer)
   - Partitioning for time-series data

2. **Caching:**
   - Redis Cluster
   - Cache frequently accessed data (squad rosters, PBs)

3. **CDN:**
   - CloudFront for static assets
   - Edge caching for public pages

4. **Microservices:**
   - Horizontal scaling (add more ECS tasks)
   - Auto-scaling based on CPU/memory

---

## Monitoring & Observability

1. **Application Monitoring:** Sentry (error tracking)
2. **Infrastructure Monitoring:** AWS CloudWatch
3. **Logging:** CloudWatch Logs + structured logging (Winston)
4. **Metrics:** Prometheus + Grafana (future)
5. **Uptime Monitoring:** Pingdom or UptimeRobot

---

**Last Updated:** December 2024
**Next Review:** After Phase 1 MVP (Q2 2025)
