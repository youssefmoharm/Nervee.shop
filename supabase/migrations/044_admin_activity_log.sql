-- Migration 044: Admin activity logging table
-- Description: Track all admin actions for audit purposes
-- Date: 2026-09-26

-- Drop existing table if exists (for re-runnable migrations)
DROP TABLE IF EXISTS admin_activity_log CASCADE;

-- Create admin activity log table
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policy - only admins can view activity log
CREATE POLICY "Admins can view activity log" ON admin_activity_log
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Create indexes for common queries
CREATE INDEX idx_admin_activity_log_user_id ON admin_activity_log(user_id);
CREATE INDEX idx_admin_activity_log_created_at ON admin_activity_log(created_at DESC);
CREATE INDEX idx_admin_activity_log_action ON admin_activity_log(action);
CREATE INDEX idx_admin_activity_log_resource ON admin_activity_log(resource_type, resource_id);

-- Grant select to authenticated users who are admins
GRANT SELECT ON admin_activity_log TO authenticated;