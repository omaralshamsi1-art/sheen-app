-- Add stock quantity tracking to ingredients
alter table ingredients
  add column if not exists stock_qty numeric(10,3) not null default 0;
