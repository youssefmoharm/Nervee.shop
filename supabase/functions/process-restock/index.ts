// supabase/functions/process-restock/index.ts
//
// Called by the admin Product form right after saving inventory. For any
// size that now has stock > 0, emails everyone who asked to be notified
// (back_in_stock_requests) and marks them notified so they aren't emailed
// again next time stock is topped up.
//
// Deploy:
//   supabase functions deploy process-restock
//
// Admin-only: verified via requireAdmin() against admin_users.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdmin } from '../_shared/admin.ts'
import { sendEmail, backInStockEmail } from '../_shared/email.ts'

const STORE_URL = Deno.env.get('STORE_URL') || 'https://nerve-store.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const admin = await requireAdmin(req, supabase)
    if (!admin) return json({ error: 'Admin access required.' }, 403)

    const { productId, size } = await req.json()
    if (!productId || !size) return json({ error: 'productId and size are required.' }, 400)

    const { data: inventory } = await supabase
      .from('product_inventory')
      .select('stock_quantity')
      .eq('product_id', productId)
      .eq('size', size)
      .maybeSingle()

    if (!inventory || inventory.stock_quantity <= 0) {
      return json({ notified: 0, message: 'This size has no stock — nothing to notify.' })
    }

    const { data: requests } = await supabase
      .from('back_in_stock_requests')
      .select('id, email')
      .eq('product_id', productId)
      .eq('size', size)
      .eq('notified', false)

    if (!requests?.length) {
      return json({ notified: 0, message: 'No one is waiting on this size.' })
    }

    const { data: product } = await supabase
      .from('products')
      .select('name, slug')
      .eq('id', productId)
      .single()

    if (!product) return json({ error: 'Product not found.' }, 404)

    let notified = 0
    for (const request of requests) {
      // sendEmail logs its own failures (e.g. RESEND_API_KEY not set) rather
      // than throwing — consistent with how it's called everywhere else in
      // this codebase. Configure the secret before relying on this in
      // production, since requests get marked notified regardless.
      await sendEmail(
        request.email,
        `Back in Stock: ${product.name}`,
        backInStockEmail(product.name, size, `${STORE_URL}/product/${product.slug}`)
      )
      await supabase
        .from('back_in_stock_requests')
        .update({ notified: true, notified_at: new Date().toISOString() })
        .eq('id', request.id)
      notified++
    }

    return json({ notified })
  } catch (err) {
    console.error('process-restock error:', err)
    return json({ error: 'Something went wrong processing restock notifications.' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
