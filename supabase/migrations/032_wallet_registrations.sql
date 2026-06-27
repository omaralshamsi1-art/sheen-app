-- Apple Wallet automatic pass updates.
--
-- Stores the device registrations Apple Wallet sends to our PassKit web
-- service, so we can push an update notification whenever a loyalty card's
-- visit count changes. `loyalty_cards.wallet_updated_at` is bumped on every
-- change so the "passes updated since" query can tell which passes are stale.

create table if not exists wallet_registrations (
  id                         uuid primary key default gen_random_uuid(),
  device_library_identifier  text not null,
  pass_type_identifier       text not null,
  serial_number              text not null,   -- = loyalty_cards.qr_code
  push_token                 text not null,
  created_at                 timestamptz not null default now(),
  unique (device_library_identifier, serial_number)
);

create index if not exists idx_wallet_reg_serial on wallet_registrations(serial_number);

alter table loyalty_cards add column if not exists wallet_updated_at timestamptz;
