-- Migration 058: Initialize default admin user for development
-- Date: 2026-10-04
-- Severity: HIGH (P1) - Security initialization
--
-- This migration creates a default admin user for development/testing purposes.
-- In production, admins should be created manually through secure channels.
--
-- To use:
-- 1. Get your user ID from Supabase Dashboard → Authentication → Users
-- 2. Replace the UUID below with your actual user ID
-- 3. Or create a new user in the Supabase Auth dashboard
--
-- Example: INSERT INTO admin_users (user_id, role) VALUES ('your-uuid-here', 'super_admin');

-- Create default admin user (replace UUID with your actual user ID)
-- For development, you can use a placeholder UUID that you'll replace
INSERT INTO admin_users (user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000001'::UUID, -- REPLACE THIS with your actual user ID
  'super_admin'
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE user_id = '00000000-0000-0000-0000-000000000001'::UUID
);

-- Alternative: If you want to grant admin to an existing user, uncomment and update:
-- INSERT INTO admin_users (user_id, role)
-- SELECT 
--   u.id,
--   'admin'
-- FROM auth.users u
-- WHERE u.email = 'your-email@example.com'  -- REPLACE THIS with your email
--   AND NOT EXISTS (
--     SELECT 1 FROM admin_users au WHERE au.user_id = u.id
--   );
