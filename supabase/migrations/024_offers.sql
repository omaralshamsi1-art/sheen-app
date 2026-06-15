-- Admin-managed customer offers (deals shown on the Offers tab).
-- An offer links to a representative menu_item for ordering, so it flows
-- through the existing order/sale pipeline unchanged (valid menu_item_id FK).

create table if not exists offers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  description    text,
  price          numeric not null,
  original_price numeric,
  category       text not null default 'Coffee',
  menu_item_id   text references menu_items(id) on delete set null,
  is_active      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

alter table offers enable row level security;
create policy "anon_read_offers" on offers for select using (true);
create policy "auth_full_offers" on offers for all using (auth.role() = 'authenticated');

create index if not exists idx_offers_active on offers(is_active, sort_order);
