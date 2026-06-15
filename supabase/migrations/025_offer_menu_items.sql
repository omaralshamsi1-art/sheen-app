-- Offers can bundle several menu items (e.g. coffee + croissant). Keep the old
-- single menu_item_id column for back-compat; new code uses menu_item_ids.
alter table offers add column if not exists menu_item_ids text[] not null default '{}';

-- Carry any existing single link into the new array.
update offers
  set menu_item_ids = array[menu_item_id]
  where menu_item_id is not null
    and (menu_item_ids is null or array_length(menu_item_ids, 1) is null);
