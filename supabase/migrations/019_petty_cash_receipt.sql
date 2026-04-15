-- Attach a receipt image URL to each petty cash transaction
alter table petty_cash_transactions
  add column if not exists receipt_url text;
