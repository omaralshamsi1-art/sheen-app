-- ─────────────────────────────────────────────
-- PUSH NOTIFICATION TOKENS
-- One row per device that has opted in to push notifications.
-- ─────────────────────────────────────────────
create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  token      text not null unique,
  platform   text,                       -- 'ios' | 'android'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_tokens_user on push_tokens(user_id);

alter table push_tokens enable row level security;

-- All access is via the server (service key); no direct client access needed
create policy "service_full_push_tokens" on push_tokens
  for all using (auth.role() = 'authenticated');
