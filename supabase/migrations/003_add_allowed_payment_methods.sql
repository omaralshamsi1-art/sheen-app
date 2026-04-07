-- Add allowed_payment_methods column to user_roles table
-- NULL means all payment methods allowed (default behavior)
-- An array like ['cash', 'card'] restricts users to those methods only

ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS allowed_payment_methods text[] DEFAULT NULL;
