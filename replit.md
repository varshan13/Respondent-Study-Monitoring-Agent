# Respondent.io Monitor Agent

## Overview

This is a full-stack web application that monitors Respondent.io for new research studies and sends email notifications when new opportunities are found. The system consists of a React frontend dashboard for monitoring and configuration, an Express backend with a background agent that periodically scrapes for new studies using Playwright, and PostgreSQL for data persistence.

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
- Email recipient management (add/remove multiple emails)
- Activity logs from the monitoring agent

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Background Processing**: In-memory agent with configurable check intervals (default: 10 minutes)
- **Web Scraping**: Playwright with headless Chromium for JavaScript-rendered content

Key backend components:
- `server/agent.ts`: Background monitoring agent that runs periodic checks
- `server/scraper.ts`: Playwright-based web scraper for Respondent.io public browse page
- `server/email.ts`: Email notifications via Gmail integration (using user's personal Gmail account)
- `server/storage.ts`: Database storage layer implementing the IStorage interface
- `server/routes.ts`: API endpoint definitions
- `server/db.ts`: PostgreSQL connection with Drizzle ORM

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Tables**:
  - `studies`: Scraped research studies with payout, duration, posted time, and notification status
  - `emailRecipients`: Email addresses for notifications with active/inactive toggle
  - `agentSettings`: Configuration for check intervals and agent status
  - `checkLogs`: Activity logs from the monitoring agent

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Database migrations: Drizzle Kit with `db:push` command

## External Dependencies

### Email Service
- **Gmail**: Sends emails from user's personal Gmail account via Replit Connectors
- OAuth credentials retrieved dynamically from Replit's connector API
- Sends beautifully formatted HTML emails with study summaries
- No domain verification required - sends directly from connected Gmail

### Web Scraping
- **Playwright**: Headless browser automation for JavaScript-rendered pages
- **Chromium**: System-installed browser used by Playwright
- Target URL: https://app.respondent.io/respondents/v2/projects/browse

### Database
- **PostgreSQL**: Required via `DATABASE_URL` environment variable
- Connection managed via `pg` Pool with Drizzle ORM wrapper

## Key Features

1. **Real-time Study Monitoring**: Scrapes Respondent.io every 10 minutes (configurable)
2. **Email Notifications**: Sends formatted HTML emails with study details when new studies are found
3. **Multiple Recipients**: Support for adding/removing multiple email addresses
4. **Activity Logging**: Real-time logs visible in the dashboard
5. **Manual Trigger**: "Check Now" button for immediate checks
6. **Study Tracking**: Stores all found studies with metadata including:
   - Title, payout, duration
   - Study type (Remote/In-Person)
   - Posted time (e.g., "2 days ago")
   - Direct link to apply
   - Description

## API Endpoints

- `GET /api/studies` - Get all found studies
- `GET /api/logs` - Get activity logs
- `GET /api/emails` - Get email recipients
- `POST /api/emails` - Add email recipient
- `DELETE /api/emails/:id` - Remove email recipient
- `PATCH /api/emails/:id` - Toggle email active status
- `GET /api/settings` - Get agent settings
- `PATCH /api/settings` - Update agent settings
- `POST /api/check` - Trigger manual check
- `POST /api/agent/start` - Start the agent
- `POST /api/agent/stop` - Stop the agent
