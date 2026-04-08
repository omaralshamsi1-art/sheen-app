-- Loyalty cards — one per customer
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE,
  email        text,
  name         text,
  qr_code      text NOT NULL UNIQUE,
  total_visits int DEFAULT 0,
  free_cups_earned int DEFAULT 0,
  free_cups_used   int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Visit history
CREATE TABLE IF NOT EXISTS loyalty_visits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      uuid REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  recorded_by  text,
  visit_type   text DEFAULT 'visit',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full loyalty_cards" ON loyalty_cards FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth full loyalty_visits" ON loyalty_visits FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX ON loyalty_cards(user_id);
CREATE INDEX ON loyalty_cards(qr_code);
CREATE INDEX ON loyalty_visits(card_id);
