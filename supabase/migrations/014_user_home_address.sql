-- Store the human-readable address text alongside coordinates
alter table user_roles
  add column if not exists home_address text;
