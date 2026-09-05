# Backend Microservices

Overview of all backend services for SwimNexus UK.

## Services Overview

| Service | Port | Status | Responsibilities |
|---------|------|--------|------------------|
| **Membership** | 3001 | 🟢 Phase 1 | Clubs, families, swimmers, squads, users, permissions, DBS, consents |
| **Finance** | 3002 | 🟢 Phase 1 | Billing, invoices, payments, GoCardless, Stripe, reconciliation |
| **Competition** | 3003 | 🟡 Phase 2 | Meets, entries, results, PBs, file parsers, volunteers |
| **Performance** | 3004 | 🟡 Phase 3 | Training, workouts, attendance, RPE, wellness, wearables |
| **Communications** | 3005 | 🟢 Phase 1 | Messages, notifications, calendar, documents |

---

## 1. Membership Service (Port 3001)

**Purpose:** Core user and organizational data management.

### Responsibilities

- **Clubs:** Registration, configuration, settings
- **Families:** Family accounts with multiple swimmers
- **Guardians:** Primary and linked guardians (separated parents)
- **Swimmers:** Swimmer profiles, SE numbers, medical notes
- **Squads:** Squad management, capacity, fees
- **Users:** Authentication, roles, permissions
- **DBS:** DBS tracking and expiry alerts
- **Consents:** Photography, video, transport, medical consents
- **Waiting List:** Queue management, trial sessions

### Key Entities

```typescript
// Club
{
  club_id: string;
  name: string;
  se_affiliation_number: string;
  config: {
    features: { video_analysis: boolean; nutrition: boolean };
    billing: { sibling_discount_2nd: number; family_cap: number };
  };
}

// Family
{
  family_id: string;
  club_id: string;
  primary_contact_id: string;
  billing_reference: string; // GoCardless mandate ID
  billing_email: string;
}

// Swimmer
{
  swimmer_id: string;
  family_id: string;
  club_id: string;
  se_number: string | null;
  first_name: string;
  last_name: string;
  dob: string; // ISO date
  gender: 'M' | 'F' | 'X';
  squad_id: string | null;
  medical_notes: string | null;
  photo_url: string | null;
}
```

### API Endpoints

```
GET    /api/v1/swimmers                 # List all swimmers (filtered by club)
POST   /api/v1/swimmers                 # Create swimmer
GET    /api/v1/swimmers/:id             # Get swimmer details
PUT    /api/v1/swimmers/:id             # Update swimmer
DELETE /api/v1/swimmers/:id             # Delete swimmer (soft delete)
POST   /api/v1/swimmers/:id/photo       # Upload photo

GET    /api/v1/families                 # List families
POST   /api/v1/families                 # Create family
GET    /api/v1/families/:id             # Get family + swimmers

GET    /api/v1/squads                   # List squads
POST   /api/v1/squads                   # Create squad
PUT    /api/v1/squads/:id               # Update squad
GET    /api/v1/squads/:id/swimmers      # Get squad roster

GET    /api/v1/dbs                      # List DBS records
POST   /api/v1/dbs                      # Create DBS record
GET    /api/v1/dbs/expiring             # Get expiring records (alerts)

GET    /api/v1/consents/:swimmerId      # Get consents for swimmer
PUT    /api/v1/consents/:swimmerId      # Update consents
```

### Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=swim_nexus_dev
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=swim-nexus-files
```

### Running Locally

```bash
# Install dependencies
pnpm install

# Run migrations
pnpm db:migrate --filter=membership

# Start in dev mode
pnpm dev --filter=membership

# Run tests
pnpm test --filter=membership
```

---

## 2. Finance Service (Port 3002)

**Purpose:** Billing, payments, and financial reconciliation.

### Responsibilities

- **Invoicing:** Generate monthly invoices with proration
- **Billing Engine:** Calculate fees (squad + siblings + ad-hoc + discounts)
- **GoCardless:** Direct Debit mandates and payments
- **Stripe:** Card payments for instant pay
- **Reconciliation:** Match payments to invoices
- **Dunning:** Automated failed payment recovery
- **Reporting:** Financial reports, aging, forecasts

### Key Entities

```typescript
// Invoice
{
  invoice_id: string;
  family_id: string;
  club_id: string;
  amount: number; // In pounds
  due_date: string;
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled';
  lines: InvoiceLine[];
}

// Invoice Line
{
  line_id: string;
  invoice_id: string;
  description: string;
  amount: number;
  type: 'squad_fee' | 'membership' | 'gala_entry' | 'merchandise' | 'other';
  swimmer_id?: string;
}

// Payment
{
  payment_id: string;
  invoice_id: string;
  family_id: string;
  amount: number;
  method: 'direct_debit' | 'card' | 'cash' | 'other';
  reference: string; // GoCardless/Stripe payment ID
  status: 'pending_submission' | 'submitted' | 'confirmed' | 'failed';
  created_at: string;
}
```

### API Endpoints

```
GET    /api/v1/invoices                 # List invoices (paginated)
GET    /api/v1/invoices/:id             # Get invoice details
POST   /api/v1/invoices/generate        # Generate monthly invoices (cron job)
GET    /api/v1/invoices/outstanding     # Get outstanding invoices
GET    /api/v1/invoices/family/:id      # Get family's invoices

POST   /api/v1/payments/:invoiceId      # Record payment
GET    /api/v1/payments                 # List payments

POST   /api/v1/mandates/create          # Create GoCardless mandate redirect
POST   /api/v1/mandates/complete        # Complete mandate setup
DELETE /api/v1/mandates/:id             # Cancel mandate

POST   /api/v1/webhooks/gocardless      # GoCardless webhook handler
POST   /api/v1/webhooks/stripe          # Stripe webhook handler

GET    /api/v1/reports/revenue          # Revenue report
GET    /api/v1/reports/aging            # Aging report
GET    /api/v1/reports/reconciliation   # Reconciliation report
```

### GoCardless Integration

```typescript
// Create mandate flow
const redirectFlow = await goCardlessService.createMandateRedirectFlow(
  familyId,
  'parent@email.com'
);
// Returns: { redirect_url: 'https://pay.gocardless.com/...', flow_id: '...' }

// User redirected to GoCardless, confirms bank details, returns to our site

// Complete mandate
await goCardlessService.completeMandateRedirectFlow(flowId, familyId);
// Stores mandate_id in families table

// Create variable payment
await goCardlessService.createPayment(familyId, invoiceId, 42.50);
// Payment submitted to GoCardless

// Webhook received (3-5 days later)
// Event: payment.confirmed → Mark invoice paid
```

### Environment Variables

```bash
GOCARDLESS_ENVIRONMENT=sandbox  # or 'live'
GOCARDLESS_ACCESS_TOKEN=your-token
GOCARDLESS_WEBHOOK_SECRET=your-webhook-secret
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 3. Competition Service (Port 3003)

**Purpose:** Meet management, entries, results, and personal bests.

### Responsibilities

- **Meets:** Import meet files (.hy3, .sex), parse events
- **Entries:** Swimmer entry workflow with eligibility checking
- **Results:** Import results, update PBs automatically
- **Personal Bests:** Track PBs by course (LC/SC)
- **File Parsers:** Hy-Tek, SportSystems, SDIF formats
- **Volunteers:** Manage volunteer shifts for meets
- **Time Conversion:** LC ↔ SC conversion using ASA tables

### Key Entities

```typescript
// Meet
{
  meet_id: string;
  club_id: string;
  name: string;
  venue: string;
  date: string;
  age_date: string; // Date for age calculations
  course: 'LC' | 'SC';
  license_level: number;
  import_file_blob: Buffer; // Original file
  parser_type: 'hytek' | 'sportsystems' | 'sdif';
}

// Event
{
  event_id: string;
  meet_id: string;
  event_code: string; // e.g., 'M200FR'
  number: number;
  distance: number;
  stroke: 'FR' | 'BK' | 'BR' | 'FL' | 'IM' | 'MR';
  gender: 'M' | 'F' | 'X';
  age_group: string | null; // '10-11', 'Open', etc.
  qualification: {
    upper_limit?: number; // Seconds (too fast)
    lower_limit?: number; // Seconds (minimum qualifying time)
  };
}

// Entry
{
  entry_id: string;
  meet_id: string;
  swimmer_id: string;
  event_id: string;
  entry_time: number; // Seconds
  status: 'entered' | 'scratched' | 'swum';
}

// Personal Best
{
  pb_id: string;
  swimmer_id: string;
  event_code: string;
  course: 'LC' | 'SC';
  time: number; // Seconds
  date: string;
  meet_id: string;
}
```

### API Endpoints

```
GET    /api/v1/meets                    # List meets
POST   /api/v1/meets/import             # Import meet file (multipart/form-data)
GET    /api/v1/meets/:id                # Get meet details
GET    /api/v1/meets/:id/events         # Get meet events
GET    /api/v1/meets/:id/eligible       # Get eligible swimmers per event

POST   /api/v1/entries                  # Create entry
GET    /api/v1/entries/:meetId          # Get entries for meet
POST   /api/v1/entries/:id/scratch      # Scratch entry
POST   /api/v1/meets/:id/export         # Generate entry file (.hy3 or .sex)

POST   /api/v1/results/import           # Import results file
GET    /api/v1/results/:meetId          # Get results for meet

GET    /api/v1/pbs/:swimmerId           # Get swimmer's PBs
GET    /api/v1/pbs/:swimmerId/:event    # Get PB for specific event
```

### File Parsers

**Supported Formats:**

| Format | Extension | Description |
|--------|-----------|-------------|
| Hy-Tek | .hy3, .cl2, .ev3 | Global standard (50% UK meets) |
| SportSystems | .sex, .set | UK legacy (50% UK meets) |
| SDIF | .sd3 | Rankings export/import |
| LENEX | .lef (XML) | European standard (future) |

**Parser Interface:**

```typescript
interface IMeetParser {
  canParse(buffer: Buffer): boolean;
  parseMeetFile(buffer: Buffer): Promise<ParsedMeet>;
  parseResultsFile(buffer: Buffer): Promise<ParsedResult[]>;
  generateEntryFile(entries: Entry[]): Promise<Buffer>;
}
```

---

## 4. Performance Service (Port 3004)

**Purpose:** Training management and athlete performance analytics.

### Responsibilities

- **Training Sessions:** Create sessions, assign workouts
- **Attendance:** Log attendance, RPE (Rate of Perceived Exertion)
- **Workouts:** Workout builder with natural language parsing
- **Training Load:** Calculate ACWR (Acute:Chronic Workload Ratio)
- **Wellness:** Daily wellness questionnaire
- **Wearables:** Integration with Apple Watch, Garmin, Polar, WHOOP
- **CSS:** Critical Swim Speed testing and tracking
- **Analytics:** Performance dashboards, trends, benchmarking

### Key Entities

```typescript
// Training Session
{
  session_id: string;
  squad_id: string;
  club_id: string;
  date: string;
  start_time: string;
  end_time: string;
  workout: {
    warm_up: string[];
    main_set: string[];
    cool_down: string[];
    total_meters: number;
  };
  coach_id: string;
}

// Attendance Log
{
  log_id: string;
  session_id: string;
  swimmer_id: string;
  attended: boolean;
  rpe: number | null; // 1-10
  notes: string | null;
  created_at: string;
}

// Wellness Log
{
  log_id: string;
  swimmer_id: string;
  date: string;
  sleep_quality: number; // 1-5
  sleep_hours: number;
  energy: number; // 1-5
  soreness: number; // 1-5
  stress: number; // 1-5
  mood: number; // 1-5
}

// Training Load (calculated)
{
  swimmer_id: string;
  date: string;
  acute_load: number; // 7-day rolling
  chronic_load: number; // 28-day rolling
  acwr: number; // Acute / Chronic
  status: 'green' | 'amber' | 'red';
}
```

### API Endpoints

```
GET    /api/v1/sessions                 # List sessions
POST   /api/v1/sessions                 # Create session
GET    /api/v1/sessions/:id             # Get session details
PUT    /api/v1/sessions/:id             # Update session

POST   /api/v1/attendance/:sessionId    # Log attendance
GET    /api/v1/attendance/:sessionId    # Get attendance for session
GET    /api/v1/attendance/swimmer/:id   # Get swimmer's attendance history

GET    /api/v1/workouts                 # List workout library
POST   /api/v1/workouts                 # Create workout
POST   /api/v1/workouts/parse           # Parse natural language workout

GET    /api/v1/wellness/:swimmerId      # Get wellness logs
POST   /api/v1/wellness                 # Log wellness

GET    /api/v1/analytics/load/:id       # Get training load for swimmer
GET    /api/v1/analytics/squad/:id      # Get squad analytics
```

### Workout Parser

```typescript
// Input (natural language)
"8x100 FR @1:30 desc 1-4"

// Parsed Output
{
  reps: 8,
  distance: 100,
  stroke: 'FR',
  interval: 90, // seconds
  modifier: 'desc 1-4',
  volume: 800,
  estimated_duration: 720 // seconds
}
```

---

## 5. Communications Service (Port 3005)

**Purpose:** Messaging, notifications, calendar, and documents.

### Responsibilities

- **Messages:** Club-wide, squad, and individual messaging
- **Safeguarding:** U18 auto-CC to parents, audit trails
- **Notifications:** Push (web push), email, SMS
- **Calendar:** Training sessions, meets, club events
- **Documents:** Handbooks, policies, forms with e-signatures

### Key Entities

```typescript
// Message
{
  message_id: string;
  club_id: string;
  sender_id: string;
  channel_type: 'club_wide' | 'squad' | 'individual';
  channel_id: string | null; // squad_id or null
  subject: string;
  body: string;
  created_at: string;
  recipients: MessageRecipient[];
}

// Message Recipient
{
  recipient_id: string;
  message_id: string;
  user_id: string;
  read_at: string | null;
  auto_cc: boolean; // True if auto-CC'd for safeguarding
}

// Notification
{
  notification_id: string;
  user_id: string;
  type: 'message' | 'payment' | 'session' | 'alert';
  title: string;
  body: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}
```

### API Endpoints

```
GET    /api/v1/messages                 # Get inbox
POST   /api/v1/messages                 # Send message
GET    /api/v1/messages/:id             # Get message details
POST   /api/v1/messages/:id/read        # Mark as read

GET    /api/v1/notifications            # Get notifications
POST   /api/v1/notifications/:id/read   # Mark notification read
POST   /api/v1/notifications/read-all   # Mark all read

GET    /api/v1/calendar                 # Get calendar events
POST   /api/v1/calendar                 # Create event

GET    /api/v1/documents                # List documents
POST   /api/v1/documents                # Upload document
GET    /api/v1/documents/:id            # Download document
```

### Safeguarding Features

```typescript
// When sending message to U18 swimmer:
if (recipient.age < 18) {
  // Auto-CC parent/guardian
  const guardians = await getGuardians(recipient.family_id);
  for (const guardian of guardians) {
    await createMessageRecipient({
      message_id,
      user_id: guardian.user_id,
      auto_cc: true,
    });
  }

  // Log to audit trail
  await auditLog({
    action: 'message_sent_to_minor',
    metadata: {
      sender_id,
      recipient_id: recipient.user_id,
      guardians_cc: guardians.map(g => g.email),
    },
  });
}
```

---

## Shared Code

All services share:

- **@club-manager/shared-types:** TypeScript types
- **@club-manager/validation:** Zod schemas
- **@club-manager/utils:** Common utilities (date formatting, etc.)
- **@club-manager/database:** Database connection, base repository
- **@club-manager/logger:** Winston logger

```typescript
// Example: Using shared types
import { CreateSwimmerDto, Swimmer } from '@club-manager/shared-types';
import { createSwimmerSchema } from '@club-manager/validation';

@Post()
async create(@Body() dto: CreateSwimmerDto): Promise<Swimmer> {
  // Validation happens in pipe
  return this.swimmersService.create(dto);
}
```

---

## Testing Services

```bash
# Unit tests
pnpm test --filter=membership

# Integration tests (requires DB)
pnpm test:e2e --filter=membership

# All services
pnpm test --filter='./services/*'
```

---

## Service Dependencies

```
Membership Service (no dependencies)
    ↓
Finance Service (depends on Membership)
    ↓
Competition Service (depends on Membership)
    ↓
Performance Service (depends on Membership)
    ↓
Communications Service (depends on Membership)
```

**Note:** All services depend on Membership for user/club data.

---

## Development Tips

1. **Hot Reload:** All services use `pnpm dev` with hot reload
2. **Debugging:** Attach debugger to port 9229
3. **Database:** Use TypeORM migrations for schema changes
4. **Testing:** Write unit tests for business logic, integration tests for API endpoints
5. **Logging:** Use Winston logger, avoid console.log
6. **Error Handling:** Use NestJS exception filters

---

**For detailed service implementation, see individual service README files in `/services/<service-name>/README.md`**
