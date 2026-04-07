-- Audit log table to track all staff/admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text,
  user_email   text,
  action       text NOT NULL,        -- 'create' | 'update' | 'delete'
  entity       text NOT NULL,        -- 'sale' | 'expense' | 'fixed_cost' | 'menu_item' | 'order' | 'user_role'
  entity_id    text,                 -- ID of the affected record
  details      jsonb,                -- what changed (old/new values)
  ip_address   text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON audit_logs FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX ON audit_logs(created_at);
CREATE INDEX ON audit_logs(user_email);
CREATE INDEX ON audit_logs(entity);
CREATE INDEX ON audit_logs(action);
