-- Per-item flag: may this item be redeemed with a loyalty free cup?
-- Default false so nothing is free-eligible until an admin opts it in.
alter table menu_items
  add column if not exists free_cup_eligible boolean not null default false;
