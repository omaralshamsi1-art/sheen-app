-- Kiosk-mode attendance: PIN + AI face match
-- ──────────────────────────────────────────────────────

-- Add per-staff attendance fields
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS attendance_pin TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Each registered kiosk device gets a token saved on this side and on the iPad's localStorage
CREATE TABLE IF NOT EXISTS kiosk_tokens (
  token TEXT PRIMARY KEY,
  label TEXT,                          -- e.g. "Shop Counter iPad"
  user_agent TEXT,
  registered_by_email TEXT,
  registered_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS kiosk_tokens_active_idx ON kiosk_tokens(is_active);

-- Verification log (every clock attempt — pass or fail — for audit)
CREATE TABLE IF NOT EXISTS attendance_verify_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  action TEXT,                         -- 'in' | 'out'
  pin_match BOOLEAN,
  face_match BOOLEAN,
  face_confidence INT,
  face_reason TEXT,
  kiosk_token TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_verify_log_user_idx ON attendance_verify_log(user_id, created_at DESC);

ALTER TABLE kiosk_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_verify_log ENABLE ROW LEVEL SECURITY;
