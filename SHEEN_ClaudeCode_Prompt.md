# SHEEN Coffee Shop — Full System Build Prompt for Claude Code

> Paste this entire document into Claude Code in VS Code to build the complete system.

---

## 🧠 CONTEXT — What You Are Building

You are building a **full-stack coffee shop management system** for a real café called **SHEEN**.
The app must handle: sales tracking, daily expense recording, shop financial management (rent, utilities, wages),
an AI-powered business monitor (using the Anthropic API), and a complete admin dashboard.
This is a production-grade internal tool used daily by the shop owner and staff.

---

## 🏗️ TECH STACK

```
Frontend:        React + Vite + TypeScript
Styling:         Tailwind CSS
Backend:         Node.js + Express (REST API)
Database:        Supabase (PostgreSQL)
Auth:            Supabase Auth (email/password)
AI:              Anthropic Claude API (claude-sonnet-4-20250514)

Version Control: GitHub
Frontend Host:   Vercel  (connects to GitHub, auto-deploys on push)
Backend Host:    Railway (connects to GitHub, auto-deploys on push)
Database Host:   Supabase (managed PostgreSQL, free tier)
```

---

## 🗂️ HOW THE FOUR SERVICES CONNECT

```
GitHub repo (source of truth)
  ├── /client  → Vercel reads this folder → deploys React app
  └── /server  → Railway reads this folder → deploys Express API

Vercel (frontend)
  └── calls Railway API via VITE_API_URL

Railway (backend)
  └── calls Supabase DB via SUPABASE_URL + SUPABASE_SERVICE_KEY
  └── calls Anthropic API via ANTHROPIC_API_KEY

Supabase
  └── PostgreSQL database (tables below)
  └── Supabase Auth (handles login sessions)
  └── Supabase Realtime (live data updates)
```

---

## 📁 PROJECT STRUCTURE

```
sheen-app/                              # One GitHub repo, two deployable folders
├── client/                             # Deployed to Vercel
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   └── supabase.ts             # Supabase client (public anon key only)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx           # Main overview KPIs + charts
│   │   │   ├── Sales.tsx               # Record daily cup sales
│   │   │   ├── Expenses.tsx            # Ingredient & supply expenses
│   │   │   ├── FixedCosts.tsx          # Rent, wages, utilities
│   │   │   ├── Menu.tsx                # Menu & recipe manager
│   │   │   ├── AIMonitor.tsx           # AI business analyst chat
│   │   │   ├── Reports.tsx             # Monthly/weekly P&L summaries
│   │   │   └── Login.tsx               # Supabase Auth login page
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── TopBar.tsx
│   │   │   ├── charts/
│   │   │   │   ├── RevenueChart.tsx
│   │   │   │   ├── HourlyChart.tsx
│   │   │   │   └── CategoryPieChart.tsx
│   │   │   ├── cards/
│   │   │   │   ├── StatCard.tsx
│   │   │   │   └── InsightCard.tsx
│   │   │   └── ui/
│   │   │       ├── Button.tsx
│   │   │       ├── Modal.tsx
│   │   │       └── Toast.tsx
│   │   ├── hooks/
│   │   │   ├── useSales.ts
│   │   │   ├── useExpenses.ts
│   │   │   ├── useFixedCosts.ts
│   │   │   └── useAI.ts
│   │   ├── services/
│   │   │   ├── salesService.ts         # calls /server API
│   │   │   ├── expenseService.ts
│   │   │   ├── aiService.ts
│   │   │   └── reportsService.ts
│   │   └── types/
│   │       └── index.ts                # All shared TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── server/                             # Deployed to Railway
│   ├── src/
│   │   ├── index.ts                    # Express entry point
│   │   ├── lib/
│   │   │   └── supabase.ts             # Supabase admin client (service key)
│   │   └── routes/
│   │       ├── sales.ts
│   │       ├── expenses.ts
│   │       ├── fixedCosts.ts
│   │       ├── menu.ts
│   │       ├── ingredients.ts
│   │       ├── reports.ts
│   │       └── ai.ts                   # Anthropic API proxy
│   ├── package.json
│   └── tsconfig.json
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # All table definitions (run once)
│
├── .gitignore                          # Must include .env files
├── .env.example                        # Committed — shows required keys, no values
└── README.md
```

---

## 🗄️ SUPABASE DATABASE SCHEMA (PostgreSQL)

Run this SQL in the Supabase SQL Editor to create all tables.
Save this as `supabase/migrations/001_initial_schema.sql`

```sql
-- ─────────────────────────────────────────────
-- USERS (managed by Supabase Auth automatically)
-- auth.users table is created by Supabase
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- MENU ITEMS
-- ─────────────────────────────────────────────
create table menu_items (
  id           text primary key,             -- e.g. "latte"
  name         text not null,
  category     text not null,                -- 'Coffee' | 'Matcha' | 'Cold Drinks' | 'Açaí' | 'Desserts' | 'Bites'
  selling_price numeric(10,2) not null,
  is_active    boolean default true,
  estimated_cogs    numeric(10,2) default 0,
  packaging_cost    numeric(10,2) default 0,
  gross_margin      numeric(5,2) default 0,  -- percentage 0-100
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- INGREDIENTS MASTER LIST
-- ─────────────────────────────────────────────
create table ingredients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null,               -- 'Coffee' | 'Dairy' | 'Matcha' | 'Packaging' | 'Fruit' | 'Syrup' | 'Baking' | 'Other'
  unit         text not null,               -- 'grams' | 'ml' | 'piece'
  pack_size    text,                        -- '1000g bag'
  pack_cost    numeric(10,2) default 0,
  cost_per_unit numeric(10,4) default 0,
  notes        text,
  updated_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- RECIPE LINES (links menu items to ingredients)
-- ─────────────────────────────────────────────
create table recipe_lines (
  id              uuid primary key default gen_random_uuid(),
  menu_item_id    text references menu_items(id) on delete cascade,
  ingredient_id   uuid references ingredients(id) on delete cascade,
  qty             numeric(10,3) not null,
  unit            text not null,
  unit_cost       numeric(10,4) default 0,
  line_cost       numeric(10,4) default 0   -- qty × unit_cost
);

-- ─────────────────────────────────────────────
-- SALES
-- ─────────────────────────────────────────────
create table sales (
  id            uuid primary key default gen_random_uuid(),
  sale_date     date not null default current_date,
  recorded_at   timestamptz default now(),
  total_cups    int not null default 0,
  total_revenue numeric(10,2) not null default 0,
  recorded_by   text                          -- staff name or user id
);

create table sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid references sales(id) on delete cascade,
  menu_item_id  text references menu_items(id),
  name          text not null,
  category      text not null,
  price         numeric(10,2) not null,
  qty           int not null,
  total         numeric(10,2) not null        -- price × qty
);

-- ─────────────────────────────────────────────
-- EXPENSES (ingredient purchases)
-- ─────────────────────────────────────────────
create table expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default current_date,
  recorded_at     timestamptz default now(),
  ingredient_name text not null,
  category        text not null,
  supplier        text,
  unit            text,
  qty_bought      numeric(10,3) not null,
  unit_cost       numeric(10,4) not null,
  total_cost      numeric(10,2) not null,     -- qty_bought × unit_cost
  notes           text,
  added_by        text
);

-- ─────────────────────────────────────────────
-- FIXED COSTS (rent, wages, utilities, etc.)
-- ─────────────────────────────────────────────
create table fixed_costs (
  id           uuid primary key default gen_random_uuid(),
  month        text not null,                 -- 'YYYY-MM' e.g. '2026-04'
  category     text not null,                -- 'Rent' | 'Wages' | 'Utilities' | 'Internet' | 'Insurance' | 'Equipment' | 'Marketing' | 'Other'
  description  text not null,
  amount       numeric(10,2) not null,
  is_paid      boolean default false,
  due_date     date,
  paid_date    date,
  notes        text,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- AI CHAT HISTORY
-- ─────────────────────────────────────────────
create table ai_chats (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Only authenticated users can read/write their own data
-- ─────────────────────────────────────────────
alter table menu_items   enable row level security;
alter table ingredients  enable row level security;
alter table recipe_lines enable row level security;
alter table sales        enable row level security;
alter table sale_items   enable row level security;
alter table expenses     enable row level security;
alter table fixed_costs  enable row level security;
alter table ai_chats     enable row level security;

-- Allow all operations for authenticated users
create policy "auth users full access" on menu_items   for all using (auth.role() = 'authenticated');
create policy "auth users full access" on ingredients  for all using (auth.role() = 'authenticated');
create policy "auth users full access" on recipe_lines for all using (auth.role() = 'authenticated');
create policy "auth users full access" on sales        for all using (auth.role() = 'authenticated');
create policy "auth users full access" on sale_items   for all using (auth.role() = 'authenticated');
create policy "auth users full access" on expenses     for all using (auth.role() = 'authenticated');
create policy "auth users full access" on fixed_costs  for all using (auth.role() = 'authenticated');
create policy "auth users full access" on ai_chats     for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- USEFUL INDEXES for performance
-- ─────────────────────────────────────────────
create index on sales(sale_date);
create index on sale_items(sale_id);
create index on expenses(expense_date);
create index on expenses(category);
create index on fixed_costs(month);
create index on ai_chats(session_date);
```

---

## 📋 SHEEN MENU — Seed Data

After running the schema, seed the menu with this SQL:

```sql
insert into menu_items (id, name, category, selling_price, estimated_cogs, packaging_cost, gross_margin) values
-- COFFEE
('v60',                   'V60',                   'Coffee',      20, 3.50, 0.50, 80.0),
('espresso',              'Espresso',              'Coffee',      15, 1.80, 0.20, 86.7),
('americano',             'Americano',             'Coffee',      13, 1.80, 0.30, 83.8),
('piccolo',               'Piccolo',               'Coffee',      17, 2.20, 0.30, 85.3),
('cortado',               'Cortado',               'Coffee',      17, 2.20, 0.30, 85.3),
('latte',                 'Latte',                 'Coffee',      19, 2.80, 0.40, 83.2),
('cappuccino',            'Cappuccino',            'Coffee',      19, 2.60, 0.35, 84.5),
('flatwhite',             'Flatwhite',             'Coffee',      19, 2.70, 0.35, 83.9),
('spanish_latte',         'Spanish Latte',         'Coffee',      22, 3.50, 0.40, 82.3),
('mocha',                 'Mocha',                 'Coffee',      22, 3.80, 0.40, 81.8),
('creamy_vanilla_coffee', 'Creamy Vanilla Coffee', 'Coffee',      24, 4.20, 0.40, 81.7),
('spanish_cortado',       'Spanish Cortado',       'Coffee',      19, 3.00, 0.35, 82.9),
-- COLD DRINKS
('raspberry_iced_tea',    'Raspberry Iced Tea',    'Cold Drinks', 17, 2.40, 0.45, 83.2),
('mango_iced_tea',        'Mango Iced Tea',        'Cold Drinks', 17, 2.30, 0.45, 83.8),
('hibiscus_iced_tea',     'Hibiscus Iced Tea',     'Cold Drinks', 17, 2.10, 0.45, 84.4),
('peach_iced_tea',        'Peach Iced Tea',        'Cold Drinks', 17, 2.30, 0.45, 83.8),
-- AÇAÍ
('acai_bowl',             'Acai Bowl',             'Açaí',        28, 7.50, 0.60, 71.1),
('acai_smoothie',         'Acai Smoothie',         'Açaí',        21, 5.50, 0.45, 71.7),
-- MATCHA
('iced_matcha',           'Iced Matcha',           'Matcha',      23, 3.80, 0.45, 81.5),
('matcha',                'Matcha',                'Matcha',      25, 4.00, 0.40, 82.4),
('creamy_vanilla_matcha', 'Creamy Vanilla Matcha', 'Matcha',      28, 5.20, 0.45, 80.5),
('creamy_mango_matcha',   'Creamy Mango Matcha',   'Matcha',      28, 5.80, 0.45, 78.4),
('matcha_blended',        'Matcha Blended',        'Matcha',      23, 4.20, 0.45, 80.7),
-- DESSERTS
('cheesecake',            'Cheesecake',            'Desserts',    25, 6.00, 0.40, 74.4),
('cookies',               'Cookies',               'Desserts',    13, 2.00, 0.20, 83.1),
('sheen_signature',       'Sheen Signature',       'Desserts',     0, 0.00, 0.40,  0.0),
-- BITES
('croissant',             'Croissant',             'Bites',       10, 2.20, 0.20, 76.0),
('banana_bread',          'Banana Bread',          'Bites',       10, 1.80, 0.20, 80.0);
```

---

## ⚙️ ENVIRONMENT VARIABLES

### `client/.env` (Vercel environment — public keys only)
```env
VITE_API_URL=https://your-app.railway.app        # Railway backend URL
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key    # Safe to expose in browser
```

### `server/.env` (Railway environment — secret keys, never in browser)
```env
PORT=3000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key   # Secret — server only
ANTHROPIC_API_KEY=your_anthropic_key                  # Secret — server only
CLIENT_URL=https://your-app.vercel.app                # For CORS
```

### `.env.example` (commit this to GitHub — no real values)
```env
# Client (Vercel)
VITE_API_URL=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server (Railway)
PORT=3000
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
CLIENT_URL=
```

---

## 📦 DEPENDENCIES TO INSTALL

### Frontend (`/client`)
```bash
npm create vite@latest client -- --template react-ts
cd client
npm install @supabase/supabase-js
npm install react-router-dom
npm install recharts
npm install @tanstack/react-query
npm install react-hot-toast
npm install date-fns
npm install axios
npm install tailwindcss @tailwindcss/vite
```

### Backend (`/server`)
```bash
mkdir server && cd server
npm init -y
npm install express cors dotenv
npm install @supabase/supabase-js
npm install @anthropic-ai/sdk
npm install -D typescript ts-node @types/express @types/cors nodemon
```

---

## 🔌 SUPABASE CLIENT SETUP

### `client/src/lib/supabase.ts` (browser — anon key)
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### `server/src/lib/supabase.ts` (server — service key, bypasses RLS)
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
```

---

## 🚂 EXPRESS SERVER SETUP (`server/src/index.ts`)

```typescript
import express from 'express'
import cors from 'cors'
import 'dotenv/config'

import salesRouter      from './routes/sales'
import expensesRouter   from './routes/expenses'
import fixedCostsRouter from './routes/fixedCosts'
import menuRouter       from './routes/menu'
import reportsRouter    from './routes/reports'
import aiRouter         from './routes/ai'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())

app.use('/api/sales',       salesRouter)
app.use('/api/expenses',    expensesRouter)
app.use('/api/fixed-costs', fixedCostsRouter)
app.use('/api/menu',        menuRouter)
app.use('/api/reports',     reportsRouter)
app.use('/api/ai',          aiRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.listen(process.env.PORT || 3000, () => {
  console.log(`SHEEN server running on port ${process.env.PORT || 3000}`)
})
```

---

## 📱 PAGES — DETAILED REQUIREMENTS

---

### 1. `Dashboard.tsx` — Main Overview

**Display:**
- Today's date and day of week at top
- **4 KPI cards:** Total Revenue Today, Cups Sold Today, Total Expenses Today, Net Profit Today
  - Net Profit = Revenue − Ingredient Expenses − (Fixed Costs ÷ 30)
- **Revenue vs Expenses bar chart** — last 7 days side by side (use Recharts)
- **Top 5 best-selling items today** — ranked list with cups and revenue
- **Hourly sales chart** — bar chart showing cups sold by hour (6am–10pm)
- **Fixed Cost Alerts** — `fixed_costs` rows where `is_paid = false` and `due_date` within next 7 days
- **AI Quick Insight card** — auto-generated 3-bullet insight, refresh button

---

### 2. `Sales.tsx` — Record Daily Sales

**Features:**
- Category tabs: Coffee / Matcha / Cold Drinks / Açaí / Desserts / Bites
- Each item: name, price, +/− buttons, number input
- Live subtotal updates as quantities change
- "Record Sales" → POST `/api/sales` → inserts into `sales` + `sale_items` tables
- Today's sales log below the form (reverse chronological, with delete)
- Running daily total: cups + revenue
- Use Supabase Realtime to subscribe to `sale_items` so the log updates live

---

### 3. `Expenses.tsx` — Daily Ingredient Expenses

**Features:**
- Form: Date, Ingredient (autocomplete from `ingredients` table), Supplier, Qty, Unit, Unit Cost
  - Total Cost = Qty × Unit Cost (auto-calculated in UI)
- Category selector: Coffee / Dairy / Matcha / Packaging / Fruit / Syrup / Baking / Other
- Submit → POST `/api/expenses`
- Filterable log table: filter by date range and category
- Weekly and monthly totals per category
- Export to CSV button (client-side, using data already fetched)

---

### 4. `FixedCosts.tsx` — Rent, Wages, Utilities

**Features:**
- Add form: Category, Description, Amount, Due Date, Notes
  - Categories: Rent | Wages | Utilities | Internet | Insurance | Equipment | Marketing | Other
- Fixed costs list grouped by month, sorted by due date
- Each row: checkbox to mark Paid → PATCH `/api/fixed-costs/:id` sets `is_paid = true`, `paid_date = today`
- Color coding: red = overdue (`due_date < today` and not paid), yellow = due within 7 days, green = paid
- Monthly total prominently shown
- **Break-even calculator** (live):
  - Formula: `breakEvenCups = totalMonthlyFixedCosts / averageGrossMarginPerCup`
  - Pull `averageGrossMarginPerCup` from the `menu_items` table average

---

### 5. `Menu.tsx` — Menu & Recipe Manager

**Features:**
- List all `menu_items`: name, category, selling price, COGS, packaging cost, gross margin %
- Margin badge: 🟢 ≥75% | 🟡 60–74% | 🔴 <60%
- Edit modal: update `selling_price`, toggle `is_active`
- Expand each item to see `recipe_lines` with ingredient quantities and costs
- "Recalculate All Margins" → POST `/api/menu/recalculate`
  - For each item: `gross_margin = ((selling_price - estimated_cogs - packaging_cost) / selling_price) * 100`

---

### 6. `AIMonitor.tsx` — AI Business Analyst

**Auto-Analysis panel** (loads when tab opens):
- Fetches last 30 days of data from `/api/ai/context`
- POSTs to `/api/ai/chat` with context + this prompt:
  ```
  Analyze this coffee shop's performance and give me 3 specific,
  actionable bullet-point insights I should act on right now.
  ```
- Refresh button to re-run

**8 Quick Question buttons:**
- "Today's Performance Summary"
- "Best Selling Items This Week"
- "Revenue Trend — Am I Growing?"
- "Which Items Have the Best Margin?"
- "Pricing Recommendations"
- "Slow Hours — How to Boost Sales?"
- "Monthly Profit Forecast"
- "What Should I Restock?"

**Full chat interface:**
- Conversation history stored in React state (also save to `ai_chats` table)
- Typing indicator while waiting for response
- Enter key to send, Shift+Enter for new line

**AI route on the server (`server/src/routes/ai.ts`):**
```typescript
// GET /api/ai/context — build full business context from Supabase
// POST /api/ai/chat   — send messages + context to Anthropic, stream response

const systemPrompt = `
You are "Barista AI", an expert coffee shop business analyst for SHEEN café.
You have access to the following real business data:

SALES (last 30 days): {salesContext}
EXPENSES (last 30 days): {expensesContext}
FIXED COSTS (this month): {fixedCostsContext}
MENU & MARGINS: {menuContext}
NET PROFIT THIS MONTH: {netProfit}

Provide concise, specific, actionable advice. Always reference actual numbers.
Keep responses under 200 words unless a detailed analysis is requested.
Tone: warm, professional, direct.
`
```

---

### 7. `Reports.tsx` — Monthly & Weekly Reports

**Features:**
- Date range picker (default: current month)
- **P&L Summary table** fetched from `/api/reports/pl`:
  - Total Revenue
  - Total COGS (from `expenses`)
  - Gross Profit
  - Fixed Costs (from `fixed_costs` for the period)
  - Net Profit
  - Net Margin %
- Revenue breakdown pie chart by category (Recharts PieChart)
- Top 10 best sellers ranked by revenue
- Expense breakdown by category
- Day-by-day revenue table
- Export CSV button

---

### 8. `Login.tsx` — Authentication

```typescript
// Use Supabase Auth
import { supabase } from '../lib/supabase'

const { error } = await supabase.auth.signInWithPassword({ email, password })
```

- Simple centered form with SHEEN branding
- Show error message if login fails
- On success: redirect to `/dashboard`
- All routes protected: check `supabase.auth.getSession()` on load
- If no session: redirect to `/login`

---

## 🎨 DESIGN SYSTEM

```css
/* Brand Colors */
--sheen-black:  #1A1A1A;
--sheen-cream:  #F5F0E8;
--sheen-brown:  #8B4513;
--sheen-gold:   #D4A843;
--sheen-white:  #FFFFFF;
--sheen-muted:  #A0785A;

/* Typography */
Display font: "Playfair Display" (Google Fonts) — headings & logo
Body font:    "DM Sans" (Google Fonts) — all body text

/* Design Tone: Refined / Luxury Café */
Dark sidebar (#1A1A1A) + light content area (#F5F0E8)
Card-based layout with subtle shadows
Smooth 200ms transitions on all interactions
Mobile responsive — must work on tablet at the counter
```

---

## 🚀 BUILD ORDER (follow this sequence exactly)

```
Phase 1 — Foundation
  1. Init both /client and /server with their package.json
  2. Set up Supabase project → run 001_initial_schema.sql → seed menu data
  3. Create all TypeScript types in client/src/types/index.ts
  4. Set up .env files for both client and server

Phase 2 — Auth & Layout
  5. Build Login.tsx with Supabase Auth
  6. Build route protection (redirect to /login if no session)
  7. Build Sidebar + TopBar + main layout with React Router

Phase 3 — Core Data Pages
  8. Build /server routes: sales, expenses, fixed-costs, menu
  9. Build Sales.tsx + useSales hook
  10. Build Expenses.tsx + useExpenses hook
  11. Build FixedCosts.tsx + useFixedCosts hook
  12. Build Menu.tsx

Phase 4 — Intelligence
  13. Build /server/routes/reports.ts with P&L SQL query
  14. Build Reports.tsx with Recharts charts
  15. Build /server/routes/ai.ts with Anthropic API integration
  16. Build AIMonitor.tsx with chat interface

Phase 5 — Dashboard & Polish
  17. Build Dashboard.tsx aggregating from all hooks
  18. Add CSV export to Expenses and Reports
  19. Add Supabase Realtime subscriptions to Sales page
  20. Final review: loading states, error handling, toast notifications
```

---

## 🌐 DEPLOYMENT GUIDE

### Step 1 — GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/omaralshamsi1-art/sheen-app.git
git push -u origin main
```

### Step 2 — Supabase
1. Go to supabase.com → New project
2. SQL Editor → paste and run `001_initial_schema.sql`
3. SQL Editor → paste and run the menu seed SQL
4. Settings → API → copy `Project URL` and `anon key` and `service_role key`
https://itzqsgmgsmndwmcvrltb.supabase.co
sb_publishable_P2AarNQ4m9jgSIYG5hZmGg_zfeJtRKX


### Step 3 — Railway (backend)
1. Go to railway.app → New project → Deploy from GitHub
2. Select your repo → set **Root Directory** to `/server`
3. Add all server environment variables in Railway dashboard:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `CLIENT_URL`
4. Railway gives you a public URL like `https://sheen-server.railway.app`

### Step 4 — Vercel (frontend)
1. Go to vercel.com → New project → Import from GitHub
2. Set **Root Directory** to `/client`
3. Set **Build Command** to `npm run build`
4. Set **Output Directory** to `dist`
5. Add all client environment variables:
   - `VITE_API_URL` = your Railway URL
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
6. Deploy → get your public Vercel URL
7. Go back to Railway → set `CLIENT_URL` = your Vercel URL (for CORS)

### Step 5 — Auto-deploy on every push
Once connected, every `git push` to `main`:
- Vercel rebuilds the frontend automatically
- Railway rebuilds the backend automatically
- Database stays in Supabase (persistent)

---

## 💡 SPECIFIC INSTRUCTIONS FOR CLAUDE CODE

- The **Anthropic API key must never be in the frontend** — always proxy through Railway
- Use **Supabase Realtime** (`supabase.channel()`) on the Sales page so new entries appear without refresh
- All monetary values stored as `numeric(10,2)` in Postgres — display without currency symbol
- All dates stored as `date` type in Postgres, filtered as `'YYYY-MM-DD'` strings in queries
- The AI Monitor must fetch fresh data from Supabase before every API call — never use stale state
- The break-even calculator updates live as the user edits fixed cost amounts
- Every form must have: loading spinner, error toast on failure, success toast on save
- Use `React Query` for all API calls with 30-second stale time
- Add a `railway.json` in `/server` with `{ "build": { "builder": "NIXPACKS" } }`
- Add a `vercel.json` in `/client` with SPA redirect: `{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }`
- Add `.env` and `.env.local` to `.gitignore` — never commit real keys

---

## 📌 SUMMARY — WHAT EACH SERVICE DOES

| Service | Role | Free Tier |
|---|---|---|
| **GitHub** | Stores all code, triggers deployments | Free | 
| **Supabase** | PostgreSQL database + Auth + Realtime | 500MB DB, 50k auth users |
| **Railway** | Runs the Express backend / API server | $5 credit/month (usually enough) |
| **Vercel** | Serves the React frontend globally | Free for hobby projects |

## 📌 WHAT THIS SYSTEM REPLACES

| Old Method | New System |
|---|---|
| Manual cup counting | Sales page — log every item sold |
| Paper receipts for ingredients | Expenses page — every purchase logged |
| Mental math for rent/wages | Fixed Costs page — track all bills |
| Guessing drink profitability | Menu page — real margin per item |
| No business analysis | AI Monitor — Claude analyses everything |
| No financial overview | Dashboard + Reports — full P&L |


-----------------------------------

