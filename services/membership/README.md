# Membership Service

The Membership Service manages swimmers, families, and club memberships for Swim Nexus.

## Features

- Complete CRUD operations for swimmers
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

### Swimmers

- `POST /api/swimmers` - Create a new swimmer
- `GET /api/swimmers` - Get all swimmers
- `GET /api/swimmers?family_id={id}` - Get swimmers by family
- `GET /api/swimmers?club_id={id}` - Get swimmers by club
- `GET /api/swimmers?squad_id={id}` - Get swimmers by squad
- `GET /api/swimmers/statistics` - Get swimmer statistics
- `GET /api/swimmers/:id` - Get a specific swimmer
- `PATCH /api/swimmers/:id` - Update a swimmer
- `DELETE /api/swimmers/:id` - Delete a swimmer

### Example Request

Create a swimmer:

```bash
curl -X POST http://localhost:3001/api/swimmers \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Smith",
    "dob": "2010-05-15",
    "gender": "M",
    "se_number": "1234567"
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
│   │   └── swimmers/
│   │       ├── dto/               # Data Transfer Objects
│   │       ├── entities/          # TypeORM entities
│   │       ├── swimmers.controller.ts
│   │       ├── swimmers.service.ts
│   │       ├── swimmers.repository.ts
│   │       └── swimmers.module.ts
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
