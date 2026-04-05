-- =============================================
-- SHEEN Café – Initial Schema
-- =============================================

-- ─────────────────────────────────────────────
-- MENU ITEMS
-- ─────────────────────────────────────────────
create table menu_items (
  id            text primary key,
  name          text not null,
  category      text not null check (category in ('Coffee','Matcha','Cold Drinks','Açaí','Desserts','Bites')),
  selling_price numeric(10,2) not null,
  is_active     boolean not null default true,
  estimated_cogs numeric(10,2) not null default 0,
  packaging_cost numeric(10,2) not null default 0,
  gross_margin   numeric(5,2) not null default 0,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- INGREDIENTS
-- ─────────────────────────────────────────────
create table ingredients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null check (category in ('Coffee','Dairy','Matcha','Packaging','Fruit','Syrup','Baking','Other')),
  unit          text not null check (unit in ('grams','ml','piece')),
  pack_size     text,
  pack_cost     numeric(10,2) not null default 0,
  cost_per_unit numeric(10,4) not null default 0,
  notes         text,
  updated_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- RECIPE LINES (menu_item ↔ ingredient)
-- ─────────────────────────────────────────────
create table recipe_lines (
  id              uuid primary key default gen_random_uuid(),
  menu_item_id    text not null references menu_items(id) on delete cascade,
  ingredient_id   uuid not null references ingredients(id) on delete cascade,
  qty             numeric(10,3) not null,
  unit            text not null,
  unit_cost       numeric(10,4) not null default 0,
  line_cost       numeric(10,4) not null default 0
);

-- ─────────────────────────────────────────────
-- SALES
-- ─────────────────────────────────────────────
create table sales (
  id            uuid primary key default gen_random_uuid(),
  sale_date     date not null default current_date,
  recorded_at   timestamptz not null default now(),
  total_cups    int not null default 0,
  total_revenue numeric(10,2) not null default 0,
  recorded_by   text
);

create table sale_items (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references sales(id) on delete cascade,
  menu_item_id  text not null references menu_items(id),
  name          text not null,
  category      text not null,
  price         numeric(10,2) not null,
  qty           int not null,
  total         numeric(10,2) not null
);

-- ─────────────────────────────────────────────
-- EXPENSES (ingredient purchases)
-- ─────────────────────────────────────────────
create table expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default current_date,
  recorded_at     timestamptz not null default now(),
  ingredient_name text not null,
  category        text not null check (category in ('Coffee','Dairy','Matcha','Packaging','Fruit','Syrup','Baking','Other')),
  supplier        text,
  unit            text,
  qty_bought      numeric(10,3) not null,
  unit_cost       numeric(10,4) not null,
  total_cost      numeric(10,2) not null,
  notes           text,
  added_by        text
);

-- ─────────────────────────────────────────────
-- FIXED COSTS (rent, wages, utilities, etc.)
-- ─────────────────────────────────────────────
create table fixed_costs (
  id           uuid primary key default gen_random_uuid(),
  month        text not null,  -- "YYYY-MM"
  category     text not null check (category in ('Rent','Wages','Utilities','Internet','Insurance','Equipment','Marketing','Other')),
  description  text not null,
  amount       numeric(10,2) not null,
  is_paid      boolean not null default false,
  due_date     date,
  paid_date    date,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- AI CHAT HISTORY
-- ─────────────────────────────────────────────
create table ai_chats (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
alter table menu_items   enable row level security;
alter table ingredients  enable row level security;
alter table recipe_lines enable row level security;
alter table sales        enable row level security;
alter table sale_items   enable row level security;
alter table expenses     enable row level security;
alter table fixed_costs  enable row level security;
alter table ai_chats     enable row level security;

-- Anon read access for menu and ingredients (public data)
create policy "anon_read_menu" on menu_items for select using (true);
create policy "anon_read_ingredients" on ingredients for select using (true);

-- Authenticated users get full access to all tables
create policy "auth_full_menu_items"   on menu_items   for all using (auth.role() = 'authenticated');
create policy "auth_full_ingredients"  on ingredients  for all using (auth.role() = 'authenticated');
create policy "auth_full_recipe_lines" on recipe_lines for all using (auth.role() = 'authenticated');
create policy "auth_full_sales"        on sales        for all using (auth.role() = 'authenticated');
create policy "auth_full_sale_items"   on sale_items   for all using (auth.role() = 'authenticated');
create policy "auth_full_expenses"     on expenses     for all using (auth.role() = 'authenticated');
create policy "auth_full_fixed_costs"  on fixed_costs  for all using (auth.role() = 'authenticated');
create policy "auth_full_ai_chats"     on ai_chats     for all using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index idx_recipe_lines_menu on recipe_lines(menu_item_id);
create index idx_recipe_lines_ingredient on recipe_lines(ingredient_id);
create index idx_sales_date on sales(sale_date);
create index idx_sale_items_sale on sale_items(sale_id);
create index idx_expenses_date on expenses(expense_date);
create index idx_expenses_category on expenses(category);
create index idx_fixed_costs_month on fixed_costs(month);
create index idx_ai_chats_session on ai_chats(session_date);
