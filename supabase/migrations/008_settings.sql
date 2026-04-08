CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full app_settings" ON app_settings FOR ALL USING (auth.role() = 'authenticated');

-- Seed default commission rates
INSERT INTO app_settings (key, value) VALUES
('order_sources', '[{"id":"POS","commission":0},{"id":"Talabat","commission":15},{"id":"Beanz","commission":2.5},{"id":"App","commission":0},{"id":"Other","commission":0}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
