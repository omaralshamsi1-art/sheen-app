# SHEEN Coffee Shop Management System

Full-stack coffee shop management system for **SHEEN** café. Handles sales tracking, daily expense recording, shop financial management (rent, utilities, wages), an AI-powered business monitor (Anthropic API), and a complete admin dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express (REST API) |
| Database | Supabase (PostgreSQL) + Auth + Realtime |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Frontend Host | Vercel |
| Backend Host | Railway |

## Project Structure

```
sheen-app/
├── client/          → React frontend (deployed to Vercel)
├── server/          → Express API (deployed to Railway)
├── supabase/        → Database migrations & seed data
├── .env.example     → Required environment variable names
└── README.md
```

## Pages

- **Dashboard** — KPI cards, revenue charts, hourly sales, AI quick insights
- **Sales** — Record daily cup sales with live totals and Realtime updates
- **Expenses** — Log ingredient purchases, filter by date/category, CSV export
- **Fixed Costs** — Track rent, wages, utilities with payment status and break-even calculator
- **Menu** — Menu items with recipe cost breakdown and margin analysis
- **AI Monitor** — AI business analyst chat powered by Claude with real shop data
- **Reports** — Monthly/weekly P&L summaries with charts and CSV export
- **Login** — Supabase Auth email/password authentication

## Setup

1. Copy `.env.example` to `client/.env` and `server/.env`, fill in values
2. Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor
3. Seed menu data (see `SHEEN_ClaudeCode_Prompt.md`)
4. Install dependencies: `cd client && npm install` / `cd server && npm install`
5. Start dev servers: `npm run dev` in each folder

## Deployment

- **Vercel**: Connect GitHub repo, set root directory to `/client`
- **Railway**: Connect GitHub repo, set root directory to `/server`
- **Supabase**: Managed PostgreSQL — no deployment needed

Environment variables must be set in each platform's dashboard.
