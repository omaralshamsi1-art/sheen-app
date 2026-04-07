-- Add allowed_pages column to user_roles table
-- NULL means all pages allowed (default behavior)
-- An array of paths like ['/dashboard', '/sales'] restricts staff to those pages only

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS allowed_pages text[] DEFAULT NULL;
