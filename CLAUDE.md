# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuppOrIT is an IT equipment inventory and support ticket management system for enterprises. It consists of a React frontend and Express backend with PostgreSQL database.

## Development Workflow

Разработка ведется на локальной dev-машине, production-версия развернута на отдельном сервере. После внесения изменений код нужно закоммитить, запушить и задеплоить на production сервер.

## Development Commands

### Frontend (root directory)
```bash
npm install          # Install dependencies
npm run dev          # Start development server (localhost:5173)
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint check
npm run preview      # Preview production build
```

### Backend (server/ directory)
```bash
cd server
npm install          # Install dependencies
npm run dev          # Start with tsx watch (localhost:3001)
npm run build        # Compile TypeScript
npm start            # Run production build (dist/index.js)
```

### Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE supporit;"

# Apply schema
psql -U postgres -d supporit -f supabase/schema_postgres.sql

# Apply migrations as needed from supabase/ directory
```

## Architecture

### Frontend (`src/`)
- **React 19** with TypeScript, **Vite** bundler
- **Zustand** for state management - see `src/store/auth.store.ts`
- **React Router v7** - routes defined in `src/App.tsx`
- **React Hook Form + Zod** for form validation
- **TanStack Table** for data tables with sorting/filtering
- API client in `src/lib/api.ts` wraps fetch with JWT auth from localStorage
- Services in `src/services/` call API endpoints and return `{ data, error }` tuples

### Backend (`server/src/`)
- **Express** with TypeScript, runs via `tsx` in dev
- Routes in `server/src/routes/` - each maps to `/api/{resource}`
- PostgreSQL via `pg` pool in `server/src/config/database.ts`
- JWT auth middleware in `server/src/middleware/auth.ts`
- Telegram bot integration in `server/src/telegram/`
- Email services (SMTP send, IMAP receive) in `server/src/services/`

### Database
- Schema in `supabase/schema_postgres.sql`
- Migrations in `supabase/migration_*.sql`
- Main entities: users, equipment, tickets, consumables, buildings, licenses, notifications

## User Roles

Three roles with different permissions:
- `admin` - Full access, user management, settings
- `it_specialist` - Equipment, tickets, consumables management
- `employee` - Create tickets, view own equipment

Route protection uses `ProtectedRoute` component with `requiredRoles` prop.
Backend uses `requireRole(...roles)` middleware for API protection.

## Integrations

### Active Directory (LDAP)
- Service: `server/src/services/ad.service.ts`
- Routes: `server/src/routes/ad.ts`
- Lazy-loaded user list, AD connection testing, user sync

### Email (SMTP/IMAP)
- Sender: `server/src/services/email-sender.service.ts`
- Receiver: `server/src/services/email-receiver.service.ts`
- Cron jobs: `server/src/services/email-cron.service.ts`
- Auto-creates tickets from incoming emails

### Telegram Bot
- Bot setup: `server/src/telegram/bot.js`
- Routes: `server/src/routes/telegram.ts`
- Inline ticket management with callback buttons

### Zabbix Monitoring
- Service: `server/src/services/zabbix.service.ts`
- Host/device monitoring, supply level tracking

### HR_desk Integration
- Routes: `server/src/routes/integrations.ts`
- Two-way sync with HR systems via Bearer token auth

## Key File Locations

| Purpose | Location |
|---------|----------|
| All TypeScript types | `src/types/index.ts` |
| API client wrapper | `src/lib/api.ts` |
| Auth state (Zustand) | `src/store/auth.store.ts` |
| Route definitions | `src/App.tsx` |
| DB connection pool | `server/src/config/database.ts` |
| Auth middleware | `server/src/middleware/auth.ts` |
| Server entry point | `server/src/index.ts` |
| Database schema | `supabase/schema_postgres.sql` |
| Env template | `server/env.example` |

## Environment Variables

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3001/api
```

### Backend (`server/.env`)
```
DATABASE_URL=postgresql://user:password@localhost:5432/supporit
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Optional features
SMTP_ENABLED=true/false
EMAIL_RECEIVER_ENABLED=true/false
TELEGRAM_BOT_ENABLED=true/false
```

## Key Conventions

- All API responses follow `{ data, error }` pattern
- TypeScript types centralized in `src/types/index.ts`
- Backend imports use `.js` extensions (ESM with TypeScript)
- Russian language throughout UI and code comments
