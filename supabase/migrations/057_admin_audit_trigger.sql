-- Avoid accessing fields that do not exist on every audited table.
CREATE OR REPLACE FUNCTION log_admin_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Get the current authenticated user
  v_user_id := auth.uid();

  -- Get user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Only log if user exists and is admin
  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = v_user_id
  ) THEN
    INSERT INTO admin_activity_log (
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      old_value,
      new_value,
      ip_address,
      user_agent
    ) VALUES (
      v_user_id,
      COALESCE(v_user_email, 'unknown'),
      TG_OP,
      TG_TABLE_NAME,
      COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END ->> 'id',
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END ->> 'user_id',
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END ->> 'order_id'
      ),
      CASE
        WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
        ELSE NULL
      END,
      CASE
        WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW)
        ELSE NULL
      END,
      NULL,  -- IP address - would need to be passed from application
      NULL   -- User agent - would need to be passed from application
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
