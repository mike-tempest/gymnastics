# Development Guide

Complete guide for setting up and developing SwimNexus UK.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Running the Application](#running-the-application)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Database Management](#database-management)
- [Debugging](#debugging)
- [Code Style](#code-style)
- [Git Workflow](#git-workflow)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Tool               | Version | Installation                                          |
| ------------------ | ------- | ----------------------------------------------------- |
| **Node.js**        | 20+ LTS | [nodejs.org](https://nodejs.org/)                     |
| **pnpm**           | 8.15+   | `npm install -g pnpm`                                 |
| **Docker**         | 24+     | [docker.com](https://www.docker.com/)                 |
| **Docker Compose** | 2.0+    | Included with Docker Desktop                          |
| **Git**            | 2.40+   | [git-scm.com](https://git-scm.com/)                   |
| **Flutter**        | 3.19+   | [flutter.dev](https://flutter.dev/) (mobile dev only) |

### Optional Tools

- **VS Code** (recommended IDE)
  - Extensions:
    - ESLint
    - Prettier
    - Flutter
    - Docker
    - PostgreSQL
- **Postman** or **Insomnia** (API testing)
- **pgAdmin** or **TablePlus** (database GUI)

### Verify Installation

```bash
node --version    # Should be v20.x.x or higher
pnpm --version    # Should be 8.15.x or higher
docker --version  # Should be 24.x.x or higher
flutter --version # Should be 3.19.x or higher (if doing mobile dev)
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/swim-nexus.git
cd swim-nexus
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
pnpm install
```

This will install dependencies for:

- All apps (web, mobile, docs)
- All services (membership, finance, competition, performance, communications)
- All packages (shared-types, validation, utils, etc.)

### 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your configuration
nano .env  # or use your preferred editor
```

**Key environment variables:**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=swim_nexus_dev

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-secret

# GoCardless (use sandbox for development)
GOCARDLESS_ENVIRONMENT=sandbox
GOCARDLESS_ACCESS_TOKEN=your-sandbox-token
GOCARDLESS_WEBHOOK_SECRET=your-webhook-secret

# Stripe
STRIPE_SECRET_KEY=sk_test_your-stripe-test-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-test-key

# Email (MailHog for local dev)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=

# AWS S3 (MinIO for local dev)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=swim-nexus-files
S3_REGION=eu-west-2

# Next.js
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret
```

### 4. Set Up Infrastructure

Run the setup script to start all infrastructure services:

```bash
./scripts/setup-dev-env.sh
```

This script will:

1. Start PostgreSQL, Redis, MinIO, MailHog, Kong in Docker
2. Wait for services to be healthy
3. Run database migrations
4. Seed test data
5. Create S3 bucket

**Manual setup (if script fails):**

```bash
# Start Docker services
docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d

# Wait for PostgreSQL to be ready
docker exec swim-nexus-db pg_isready -U postgres

# Run migrations
pnpm run db:migrate

# Seed the demo gymnastics club
pnpm --filter @club-manager/membership-service seed:demo:gym
```

### 5. Verify Setup

Check that all services are running:

```bash
docker ps
```

You should see:

- `swim-nexus-db` (PostgreSQL)
- `swim-nexus-redis` (Redis)
- `swim-nexus-gateway` (Kong)
- `swim-nexus-s3` (MinIO)
- `swim-nexus-mailhog` (MailHog)

Access web UIs:

- **MailHog:** http://localhost:8025 (email testing)
- **MinIO Console:** http://localhost:9001 (S3 storage)
- **pgAdmin:** http://localhost:5050 (database GUI)

---

## Running the Application

### Development Mode (All Services)

```bash
# Run everything in parallel
pnpm dev
```

This starts:

- Next.js web app (http://localhost:3000)
- All 5 backend microservices
- API Gateway (http://localhost:8000)

### Run Specific Apps/Services

```bash
# Next.js web app only
pnpm dev:web

# All backend services only
pnpm dev:services

# Specific service
pnpm dev --filter=membership

# Flutter mobile app
cd apps/mobile
flutter run
```

### Production Build

```bash
# Build all apps and services
pnpm build

# Build specific app
pnpm build --filter=web

# Test production build locally
pnpm start --filter=web
```

---

## Development Workflow

### 1. Feature Branch Workflow

```bash
# Create feature branch
git checkout -b feature/add-swimmer-photos

# Make changes...

# Commit (conventional commits)
git add .
git commit -m "feat(membership): add swimmer photo upload"

# Push to remote
git push origin feature/add-swimmer-photos

# Create Pull Request on GitHub
```

### 2. Making Changes

#### Backend Service Changes

```typescript
// services/membership/src/modules/swimmers/swimmers.service.ts

@Injectable()
export class SwimmersService {
  constructor(
    private readonly swimmersRepository: SwimmersRepository,
    private readonly s3Service: S3Service
  ) {}

  async uploadPhoto(swimmerId: string, file: Express.Multer.File) {
    // Upload to S3
    const photoUrl = await this.s3Service.upload(`swimmers/${swimmerId}/photo.jpg`, file.buffer);

    // Update swimmer record
    await this.swimmersRepository.update(swimmerId, {
      photo_url: photoUrl,
    });

    return { photoUrl };
  }
}
```

**Hot reload** will automatically restart the service.

#### Next.js Changes

```tsx
// apps/web/app/(dashboard)/swimmers/[id]/page.tsx

export default async function SwimmerPage({ params }: { params: { id: string } }) {
  const swimmer = await fetchSwimmer(params.id);

  return (
    <div>
      <h1>
        {swimmer.first_name} {swimmer.last_name}
      </h1>
      {swimmer.photo_url && (
        <Image src={swimmer.photo_url} width={200} height={200} alt="Swimmer" />
      )}
    </div>
  );
}
```

**Fast Refresh** updates the page instantly (no reload).

#### Flutter Changes

```dart
// apps/mobile/lib/features/swimmers/presentation/swimmer_detail_screen.dart

class SwimmerDetailScreen extends ConsumerWidget {
  final String swimmerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final swimmer = ref.watch(swimmerProvider(swimmerId));

    return Scaffold(
      appBar: AppBar(title: Text('${swimmer.firstName} ${swimmer.lastName}')),
      body: Column(
        children: [
          if (swimmer.photoUrl != null)
            CachedNetworkImage(
              imageUrl: swimmer.photoUrl!,
              width: 200,
              height: 200,
            ),
          // ... rest of UI
        ],
      ),
    );
  }
}
```

**Hot Reload** updates the UI in under 1 second.

### 3. Adding New Endpoints

**Step 1: Add DTO**

```typescript
// packages/shared-types/src/dtos/upload-photo.dto.ts
export interface UploadPhotoDto {
  swimmer_id: string;
  photo: File;
}
```

**Step 2: Add Controller**

```typescript
// services/membership/src/modules/swimmers/swimmers.controller.ts
@Post(':id/photo')
@UseInterceptors(FileInterceptor('photo'))
async uploadPhoto(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.swimmersService.uploadPhoto(id, file);
}
```

**Step 3: Update API Client (Next.js)**

```typescript
// apps/web/lib/api/swimmers.ts
export async function uploadSwimmerPhoto(swimmerId: string, photo: File) {
  const formData = new FormData();
  formData.append('photo', photo);

  const response = await fetch(`/api/swimmers/${swimmerId}/photo`, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}
```

**Step 4: Add to Kong Configuration**

```yaml
# services/api-gateway/kong.yml
routes:
  - name: upload-swimmer-photo
    paths:
      - /api/v1/swimmers/*/photo
    methods:
      - POST
    plugins:
      - name: jwt
      - name: file-log
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests for specific service
pnpm test --filter=membership

# Run tests in watch mode
pnpm test --watch

# Generate coverage report
pnpm test:coverage
```

**Writing a unit test:**

```typescript
// services/membership/test/unit/swimmers.service.spec.ts
describe('SwimmersService', () => {
  let service: SwimmersService;
  let repository: jest.Mocked<SwimmersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SwimmersService,
        {
          provide: SwimmersRepository,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SwimmersService);
    repository = module.get(SwimmersRepository);
  });

  it('should create a swimmer', async () => {
    const dto = { first_name: 'Emma', last_name: 'Thompson', dob: '2010-05-15', gender: 'F' };
    repository.create.mockResolvedValue({ swimmer_id: '123', ...dto });

    const result = await service.create(dto);

    expect(result.swimmer_id).toBe('123');
    expect(repository.create).toHaveBeenCalledWith(dto);
  });
});
```

### Integration Tests

```bash
# Run integration/e2e tests
pnpm test:e2e

# Run for specific service
pnpm test:e2e --filter=membership
```

**Writing an integration test:**

```typescript
// services/membership/test/integration/swimmers.e2e-spec.ts
describe('Swimmers API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/v1/swimmers (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/swimmers')
      .set('Authorization', 'Bearer test-token')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

### E2E Tests (Web)

```bash
# Run Playwright tests
pnpm test:e2e:web

# Run in UI mode
pnpm test:e2e:web --ui

# Run specific test file
pnpm test:e2e:web tests/swimmers.spec.ts
```

### Flutter Tests

```bash
cd apps/mobile

# Unit tests
flutter test

# Widget tests
flutter test test/widget/

# Integration tests
flutter test integration_test/
```

---

## Database Management

### Migrations

```bash
# Create a new migration
pnpm db:migration:create AddPhotoUrlToSwimmers

# Run pending migrations
pnpm db:migrate

# Rollback last migration
pnpm db:migrate:rollback

# Show migration status
pnpm db:migrate:status
```

**Creating a migration:**

```typescript
// services/membership/src/database/migrations/1234567890-AddPhotoUrlToSwimmers.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoUrlToSwimmers1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE swimmers
      ADD COLUMN photo_url VARCHAR(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE swimmers
      DROP COLUMN photo_url;
    `);
  }
}
```

### Seeding Data

Seeds are standalone scripts in `services/membership/src/seed/`, run by name.
Each one inserts its own club row and stamps `club_id` on every record, so a
seed only ever touches its own tenant.

```bash
cd services/membership

# Demo gymnastics club (British Gymnastics, GBP). See docs/demos/gym-demo-club.md.
DB_DATABASE=your_local_db pnpm seed:demo:gym

# Demo Australian swimming club, kept as the non-UK example
DB_DATABASE=your_local_db pnpm seed:demo:au
```

Always pass `DB_*` explicitly: the repository root `.env` points at a
deployed database and a seed must never reach it.

**Creating a seeder:** copy `src/seed/gym-demo-seed.ts` and change the club.
The pattern every seed must keep is the tenancy contract:

```typescript
// services/membership/src/seed/my-demo-seed.ts
const clubResult = await dataSource.query(
  `INSERT INTO clubs (name, slug, country, currency, governing_body, status)
   VALUES ($1, $2, 'GB', 'GBP', 'BRITISH_GYMNASTICS', 'active')
   RETURNING id`,
  ['My Demo Club', CLUB_SLUG]
);
const clubId = clubResult[0].id;

// Every child row carries club_id, and the seed clears only its own club.
await dataSource.query(
  `INSERT INTO members (club_id, family_id, first_name, last_name, dob, gender)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [clubId, familyId, 'Emma', 'Novak', '2017-07-30', 'F']
);
```

Then add a `seed:demo:<name>` script to `services/membership/package.json`.

### Database Access

**Via CLI:**

```bash
# Connect to PostgreSQL
docker exec -it swim-nexus-db psql -U postgres -d swim_nexus_dev

# Run query
SELECT * FROM swimmers LIMIT 10;
```

**Via pgAdmin:**

1. Open http://localhost:5050
2. Login: `admin@swimnexus.com` / `admin`
3. Add server: `swim-nexus-db`, port `5432`, user `postgres`, password `postgres`

---

## Debugging

### Backend Services

**VS Code Launch Configuration:**

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Membership Service",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

**Run service in debug mode:**

```bash
pnpm dev:debug --filter=membership
```

Set breakpoints in VS Code and debug!

### Next.js

**Server-side debugging:**

```bash
# Start in debug mode
NODE_OPTIONS='--inspect' pnpm dev --filter=web
```

Attach debugger to port 9229.

**Client-side debugging:**
Use browser DevTools (React DevTools extension recommended).

### Flutter

```bash
# Run with DevTools
flutter run --observatory-port=9100

# Open DevTools in browser
# Visit URL shown in terminal
```

Use VS Code Flutter extension for breakpoints.

---

## Code Style

### Linting

```bash
# Lint all code
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Lint specific workspace
pnpm lint --filter=web
```

### Formatting

```bash
# Check formatting
pnpm format:check

# Format all files
pnpm format

# Format specific files
pnpm format apps/web/**/*.ts
```

### Pre-commit Hooks

We use Husky + lint-staged:

```bash
# Automatically runs on git commit:
# 1. Lints staged files
# 2. Formats staged files
# 3. Runs type checking
# 4. Runs tests for affected files
```

**Skip hooks (not recommended):**

```bash
git commit --no-verify -m "message"
```

### TypeScript

```bash
# Type check all code
pnpm typecheck

# Type check specific workspace
pnpm typecheck --filter=web
```

---

## Git Workflow

### Commit Message Format

We use **Conventional Commits:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(membership): add swimmer photo upload
fix(finance): correct proration calculation for mid-month changes
docs(readme): update setup instructions
test(competition): add tests for .hy3 parser
```

### Branch Naming

```
<type>/<short-description>

Examples:
feature/swimmer-photos
fix/proration-bug
docs/update-readme
refactor/extract-parsers
```

### Pull Request Process

1. Create feature branch
2. Make changes + commit
3. Push to GitHub
4. Create Pull Request
5. Wait for CI checks to pass
6. Request review from team member
7. Address feedback
8. Merge (squash and merge)

**PR Title:** Same format as commit messages
**PR Description:** Include context, testing notes, screenshots if UI change

---

## Troubleshooting

### Docker Issues

**Problem:** "Port already in use"

```bash
# Find process using port
lsof -i :5432

# Kill process
kill -9 <PID>

# Or change port in docker-compose.yml
```

**Problem:** "Cannot connect to Docker daemon"

```bash
# Start Docker Desktop
# Or on Linux:
sudo systemctl start docker
```

**Problem:** Services not healthy

```bash
# Check logs
docker logs swim-nexus-db

# Restart service
docker restart swim-nexus-db

# Full restart
docker-compose -f infrastructure/docker/docker-compose.dev.yml restart
```

### pnpm Issues

**Problem:** "ENOENT: no such file or directory"

```bash
# Clean install
rm -rf node_modules
pnpm install
```

**Problem:** Workspace dependencies not found

```bash
# Rebuild all packages
pnpm build --filter='./packages/*'
```

### Database Issues

**Problem:** "relation does not exist"

```bash
# Run migrations
pnpm db:migrate

# If still failing, drop and recreate the local database (destroys data)
dropdb swim_nexus_dev && createdb swim_nexus_dev
pnpm db:migrate
pnpm --filter @club-manager/membership-service seed:demo:gym
```

**Problem:** "Connection refused"

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection settings in .env
cat .env | grep DB_
```

### Next.js Issues

**Problem:** "Module not found"

```bash
# Clear Next.js cache
rm -rf apps/web/.next
pnpm dev --filter=web
```

**Problem:** API routes not working

```bash
# Check Kong configuration
docker exec swim-nexus-gateway kong config check /kong/kong.yml

# Restart Kong
docker restart swim-nexus-gateway
```

### Flutter Issues

**Problem:** "Gradle build failed"

```bash
cd apps/mobile/android
./gradlew clean

cd ..
flutter clean
flutter pub get
flutter run
```

**Problem:** "CocoaPods not installed"

```bash
sudo gem install cocoapods
cd apps/mobile/ios
pod install
```

---

## Getting Help

- **Documentation:** Check README files in each workspace
- **Issues:** Search existing GitHub Issues
- **Team Chat:** [Slack/Discord channel]
- **Email:** [dev-team@swimnexus.com]

---

**Last Updated:** December 2024
