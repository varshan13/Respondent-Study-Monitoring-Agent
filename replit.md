# Respondent.io Monitor Agent

## Overview

This is a full-stack web application that monitors Respondent.io for new research studies and sends email notifications when new opportunities are found. The system consists of a React frontend dashboard for monitoring and configuration, an Express backend with a background agent that periodically scrapes for new studies, and PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Theme Support**: next-themes for dark/light mode switching

The frontend is a single-page application with a dashboard that displays:
- Found studies with payout and duration info
- Agent status and controls (start/stop/manual check)
- Email recipient management
- Activity logs from the monitoring agent

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Background Processing**: In-memory agent with configurable check intervals

Key backend components:
- `server/agent.ts`: Background monitoring agent that runs periodic checks
- `server/scraper.ts`: Web scraper for Respondent.io (requires auth, falls back to demo mode)
- `server/email.ts`: Email notifications via Resend integration
- `server/storage.ts`: Database storage layer implementing the IStorage interface
- `server/routes.ts`: API endpoint definitions

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Tables**:
  - `studies`: Scraped research studies with payout, duration, and notification status
  - `emailRecipients`: Email addresses for notifications with active/inactive toggle
  - `agentSettings`: Configuration for check intervals and agent status
  - `checkLogs`: Activity logs from the monitoring agent

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Database migrations: Drizzle Kit with `db:push` command

## External Dependencies

### Email Service
- **Resend**: Email delivery service accessed via Replit Connectors
- Credentials retrieved dynamically from Replit's connector API
- Configured sender email with fallback to `onboarding@resend.dev`

### Database
- **PostgreSQL**: Required via `DATABASE_URL` environment variable
- Connection managed via `pg` Pool with Drizzle ORM wrapper

### Third-Party Integrations
- **Respondent.io**: Target website for scraping studies (requires authentication for live data)
- Falls back to demo mode when authentication is not available

### Key NPM Dependencies
- `@tanstack/react-query`: Server state management
- `drizzle-orm` / `drizzle-zod`: Database ORM and validation
- `resend`: Email service client
- `framer-motion`: Animation library for UI transitions
- `sonner`: Toast notifications