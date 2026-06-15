-- Optional percentage pricing for offers. When discount_percent is set, the
-- offer's price is computed live from the chosen items' prices minus this %
-- (fixed `price` is used when discount_percent is null).
alter table offers add column if not exists discount_percent numeric;
