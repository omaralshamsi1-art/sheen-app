create table petty_cash_transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('deposit', 'withdrawal')),
  amount      numeric(10,2) not null check (amount > 0),
  description text not null,
  category    text,
  date        date not null default current_date,
  notes       text,
  added_by    text,
  recorded_at timestamptz not null default now()
);
