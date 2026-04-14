-- Per-item add-ons (name + price) e.g. Extra Peanut Butter +5, Extra Granola +3
alter table menu_items
  add column if not exists addons jsonb;
