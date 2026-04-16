-- Per-item toggle to show/hide the Extra Shot dropdown (default true for Coffee)
alter table menu_items
  add column if not exists show_extra_shot boolean default true;
