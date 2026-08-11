// supabase/functions/_shared/admin.ts
//
// Verifies the caller's JWT belongs to a real admin (checked against
// admin_users using the service-role client, bypassing RLS). Every edge
// function that performs an admin-only action calls this FIRST — it's the
// one place that authorization decision gets made.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient
): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data: userData } = await supabase.auth.getUser(token)
  if (!userData?.user) return null

  const { data: adminRow } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  return adminRow ? { id: userData.user.id } : null
}
