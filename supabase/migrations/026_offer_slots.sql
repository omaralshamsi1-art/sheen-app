-- Choice groups for offers: e.g. "pick any 1 coffee".
-- Each slot = { label, options: menu_item_id[] } and the customer picks one.
-- menu_item_ids (from 025) stays as the FIXED items always included in the offer.
alter table offers add column if not exists slots jsonb not null default '[]';
