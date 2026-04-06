-- ─────────────────────────────────────────────
-- USER ROLES
-- ─────────────────────────────────────────────
create table user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique,
  email      text not null,
  role       text not null default 'customer' check (role in ('admin', 'staff', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table user_roles enable row level security;

-- Everyone can read their own role
create policy "users_read_own_role" on user_roles
  for select using (auth.uid() = user_id);

-- Admin can read/write all roles (via service key on server)
create policy "auth_full_user_roles" on user_roles
  for all using (auth.role() = 'authenticated');

-- Index
create index idx_user_roles_user on user_roles(user_id);
create index idx_user_roles_email on user_roles(email);
