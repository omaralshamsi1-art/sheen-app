-- Time attendance with WebAuthn (fingerprint / Face ID)
-- ──────────────────────────────────────────────────────

-- Per-day attendance row: one record per (user, date)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  in_method TEXT,        -- 'webauthn' | 'manual'
  out_method TEXT,
  in_device TEXT,
  out_device TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS attendance_user_idx ON attendance(user_id, date DESC);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance(date DESC);

-- WebAuthn credentials (one or many per user, one per device)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,                 -- credential.id (base64url)
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  public_key TEXT NOT NULL,            -- base64url-encoded public key
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[],                   -- ['internal', 'hybrid', etc.]
  device_label TEXT,                   -- e.g. "iPhone 15 - Safari"
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials(user_id);

-- Short-lived challenges (issued on /options, consumed on /verify)
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge TEXT NOT NULL,
  purpose TEXT NOT NULL,               -- 'enroll' | 'clock'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_user_idx ON webauthn_challenges(user_id, purpose, created_at DESC);
