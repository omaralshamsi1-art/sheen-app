-- Rename the customer-app sales source from "App" to "Sheen App" so the
-- Dashboard "Sales by source" card shows the brand name.
--
-- The dashboard matches the configured source name to the value stored in
-- sales.recorded_by (case-insensitively), so both must be renamed together.

-- 1) Existing sales rows recorded as the app source.
update sales
set recorded_by = 'Sheen App'
where lower(recorded_by) = 'app';

-- 2) The configured source list (so it stays editable + keeps its commission).
update app_settings
set value = replace(value::text, '"id":"App"', '"id":"Sheen App"')::jsonb
where key = 'order_sources';
