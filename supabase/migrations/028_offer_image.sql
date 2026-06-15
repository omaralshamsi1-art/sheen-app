-- Optional photo for an offer/combo (shown on the customer Offers tab).
alter table offers add column if not exists image_url text;
