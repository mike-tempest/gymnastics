# Membership Service

The Membership Service manages members, families, and club memberships for Swim Nexus.

## Features

- Complete CRUD operations for members
- TypeORM with PostgreSQL database
- Automatic validation using class-validator
- Database migrations support
- Query filtering by family, club, and squad
- Production-ready with proper error handling

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL >= 14
- pnpm >= 8.15.0

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Setup

Copy the example environment file and configure your database:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=swim_nexus_membership

CORS_ORIGIN=http://localhost:3000
```

### 3. Database Setup

Create the database:

```bash
createdb swim_nexus_membership
```

Or using psql:

```sql
CREATE DATABASE swim_nexus_membership;
```

Run migrations:

```bash
pnpm db:migrate
```

### 4. Start the Service

Development mode with hot reload:

```bash
pnpm dev
```

Production mode:

```bash
pnpm build
pnpm start
```

The service will be available at `http://localhost:3001/api`

## API Endpoints

### Members

- `POST /api/members` - Create a new member
- `GET /api/members` - Get all members
- `GET /api/members?family_id={id}` - Get members by family
- `GET /api/members?club_id={id}` - Get members by club
- `GET /api/members?squad_id={id}` - Get members by squad
- `GET /api/members/statistics` - Get member statistics
- `GET /api/members/:id` - Get a specific member
- `PATCH /api/members/:id` - Update a member
- `DELETE /api/members/:id` - Delete a member

### Example Request

Create a member:

```bash
curl -X POST http://localhost:3001/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "dob": "2010-05-15",
    "gender": "M",
    "registration_number": "1234567"
  }'
```

## Database Migrations

Create a new migration:

```bash
pnpm db:migrate:create --name=YourMigrationName
```

Run pending migrations:

```bash
pnpm db:migrate
```

Revert last migration:

```bash
pnpm db:migrate:revert
```

## Project Structure

```
services/membership/
├── src/
│   ├── config/
│   │   └── typeorm.config.ts      # TypeORM configuration
│   ├── database/
│   │   └── migrations/            # Database migrations
│   ├── modules/
│   │   └── members/
│   │       ├── dto/               # Data Transfer Objects
│   │       ├── entities/          # TypeORM entities
│   │       ├── members.controller.ts
│   │       ├── members.service.ts
│   │       ├── members.repository.ts
│   │       └── members.module.ts
│   ├── app.module.ts              # Root module
│   └── main.ts                    # Application entry point
├── .env.example                   # Environment template
├── nest-cli.json                  # NestJS CLI config
├── package.json
└── tsconfig.json
```

## Development

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

### Testing

```bash
pnpm test
pnpm test:watch
pnpm test:cov
```

## Technologies

- **NestJS** - Progressive Node.js framework
- **TypeORM** - ORM for TypeScript and JavaScript
- **PostgreSQL** - Database
- **class-validator** - Validation decorators
- **class-transformer** - Object transformation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment mode | development |
| PORT | Server port | 3001 |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_USERNAME | Database username | postgres |
| DB_PASSWORD | Database password | postgres |
| DB_DATABASE | Database name | swim_nexus_membership |
| CORS_ORIGIN | CORS allowed origin | http://localhost:3000 |

## License

UNLICENSED
