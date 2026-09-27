-- Migration 048: Add RLS policy for admin_activity_log
-- Date: 2026-09-26

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
