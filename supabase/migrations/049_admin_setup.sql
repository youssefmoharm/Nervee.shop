-- Migration 049: Admin setup - create admin_activity_log and sample admin users
-- Date: 2026-09-26

-- Create admin_activity_log table for audit logging
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_activity_log table
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can view activity log" ON admin_activity_log;

-- Create RLS policy - only admins can view activity log
CREATE POLICY "Admins can view activity log" ON admin_activity_log
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Allow service_role to insert (for server-side logging)
GRANT INSERT ON admin_activity_log TO service_role;

-- Revoke all other access
REVOKE ALL ON admin_activity_log FROM anon, authenticated;

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_user_id ON admin_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON admin_activity_log(created_at);

-- Insert sample admin users (replace with actual UUIDs from your Supabase Auth)
-- To get your user ID, go to Supabase Dashboard → Authentication → Users and copy the UUID
-- Then run: INSERT INTO admin_users (user_id, role) VALUES ('your-uuid-here', 'admin');

-- Example admin user 1 (replace with actual UUID)
-- INSERT INTO admin_users (user_id, role) VALUES ('00000000-0000-0000-0000-000000000001', 'admin');

-- Example admin user 2 (replace with actual UUID)
-- INSERT INTO admin_users (user_id, role) VALUES ('00000000-0000-0000-0000-000000000002', 'admin');
