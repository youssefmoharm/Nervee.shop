/**
 * Log Admin Activity Edge Function
 * Logs administrative actions to the admin_activity_log table
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async req => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify JWT token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Parse request body
    const body = await req.json();

    // Validate required fields
    if (!body.action || !body.userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action and userEmail' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Get Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const { data: user, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.user.id)
      .maybeSingle();

    if (adminError || !admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get IP address
    const ip =
      req.headers.get('X-Forwarded-For') ||
      req.headers.get('CF-Connecting-IP') ||
      req.headers.get('X-Real-IP') ||
      'unknown';

    // Get user agent
    const userAgent = req.headers.get('User-Agent') || 'unknown';

    // Insert activity log
    const { error } = await supabase.from('admin_activity_log').insert({
      user_id: user.user.id,
      user_email: body.userEmail,
      action: body.action,
      resource_type: body.resourceType || null,
      resource_id: body.resourceId || null,
      old_value: body.oldValue || null,
      new_value: body.newValue || null,
      ip_address: ip,
      user_agent: userAgent,
    });

    if (error) {
      console.error('Failed to log admin activity:', error);
      return new Response(JSON.stringify({ error: 'Failed to log activity' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
