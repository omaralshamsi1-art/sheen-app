-- ─────────────────────────────────────────────
-- ORDERS (customer orders)
-- ─────────────────────────────────────────────
create table orders (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null,
  customer_email text,
  customer_name  text,
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'completed')),
  total_amount numeric(10,2) not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  menu_item_id text not null references menu_items(id),
  name         text not null,
  price        numeric(10,2) not null,
  qty          int not null,
  total        numeric(10,2) not null
);

-- RLS
alter table orders enable row level security;
alter table order_items enable row level security;

-- Customers can read their own orders
create policy "customers_read_own_orders" on orders
  for select using (auth.uid() = customer_id);

-- Customers can insert their own orders
create policy "customers_insert_orders" on orders
  for insert with check (auth.uid() = customer_id);

-- Authenticated users full access (for staff/admin via service key)
create policy "auth_full_orders" on orders
  for all using (auth.role() = 'authenticated');

create policy "auth_full_order_items" on order_items
  for all using (auth.role() = 'authenticated');

-- Indexes
create index idx_orders_customer on orders(customer_id);
create index idx_orders_status on orders(status);
create index idx_orders_created on orders(created_at);
create index idx_order_items_order on order_items(order_id);
