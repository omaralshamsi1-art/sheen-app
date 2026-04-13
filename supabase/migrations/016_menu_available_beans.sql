-- Each coffee menu item can restrict which beans are available.
-- When null or empty, all global beans are shown.
alter table menu_items
  add column if not exists available_beans jsonb;
