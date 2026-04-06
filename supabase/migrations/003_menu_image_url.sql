-- Add image_url column to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for menu images (run in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);
