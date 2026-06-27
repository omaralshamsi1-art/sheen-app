-- Sales "by source" fix.
--
-- Previously `recorded_by` was overloaded: manual POS sales stored a real
-- source name ('Cash', 'Talabat', 'App'...), but order-derived sales (the
-- customer app + staff drive-through loyalty scan) stored a de-dup key in the
-- form 'order:<uuid>'. That made every app/drive-through order show up as its
-- own row in the Dashboard "Sales by source" card instead of grouping under a
-- proper source.
--
-- This migration adds a dedicated `order_id` column to use as the de-dup key,
-- and backfills `recorded_by` with a real source name so the card groups
-- correctly.

alter table sales add column if not exists order_id uuid;
create index if not exists idx_sales_order_id on sales(order_id);

-- Backfill existing order-derived sales: move the order id into order_id and
-- replace recorded_by with a clean source name.
update sales
set
  order_id = nullif(substring(recorded_by from 7), '')::uuid,
  recorded_by = case
    when notes ilike '%drive-through%' then 'Cash'   -- legacy drive-through was always cash
    else 'App'                                       -- all customer-app orders (card / Apple Pay / app cash)
  end
where recorded_by like 'order:%';
