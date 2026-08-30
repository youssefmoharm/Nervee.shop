// supabase/functions/back-in-stock/index.ts
//
// Secure back-in-stock notification endpoint with validation and rate limiting

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getCorsHeaders } from '../_shared/cors.ts'
import { rateLimit, getRateLimitHeaders } from '../_shared/ratelimit.ts'
import { 
  validateEmail, 
  validateUUID, 
  validateSize, 
  validateRequestSize,
  ValidationException 
} from '../_shared/validation.ts'
import { 
  logRateLimitHit,
  PerformanceTimer 
} from '../_shared/monitoring.ts'

interface BackInStockRequest {
  email: string
  productId: string
  size: string
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  const timer = new PerformanceTimer('back-in-stock')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Request size validation
    const sizeErrors = validateRequestSize(req, 5) // 5KB max
    if (sizeErrors.length > 0) {
      timer.end()
      return json({ error: 'Request too large', details: sizeErrors }, 413, corsHeaders)
    }

    // Rate limiting: 10 requests per minute per IP
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'anonymous'
    const allowed = rateLimit(ip, { windowMs: 60000, maxRequests: 10 })
    
    if (!allowed) {
      logRateLimitHit(ip, 'back-in-stock')
      const rateLimitHeaders = getRateLimitHeaders(ip, { windowMs: 60000, maxRequests: 10 })
      timer.end()
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again in a minute.' }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body: BackInStockRequest = await req.json()

    // Validate input
    const errors = [
      ...validateEmail(body.email),
      ...validateUUID(body.productId, 'productId'),
      ...validateSize(body.size),
    ]

    if (errors.length > 0) {
      timer.end()
      return json({ error: 'Validation failed', details: errors }, 400, corsHeaders)
    }

    const email = body.email.trim().toLowerCase()
    
    // Verify product exists and is active
    const { data: product } = await supabase
      .from('products')
      .select('id, name')
      .eq('id', body.productId)
      .eq('is_active', true)
      .maybeSingle()

    if (!product) {
      timer.end()
      return json({ error: 'Product not found or unavailable' }, 404, corsHeaders)
    }

    // Check if product/size is currently in stock
    const { data: inventory } = await supabase
      .from('product_inventory')
      .select('in_stock, stock_quantity')
      .eq('product_id', body.productId)
      .eq('size', body.size)
      .maybeSingle()

    if (!inventory) {
      timer.end()
      return json({ error: 'This size is not available for this product' }, 400, corsHeaders)
    }

    if (inventory.in_stock && inventory.stock_quantity > 0) {
      timer.end()
      return json({ 
        success: true, 
        message: 'This item is currently in stock! You can order it now.' 
      }, 200, corsHeaders)
    }

    // Check if already requested
    const { data: existing } = await supabase
      .from('back_in_stock_requests')
      .select('id')
      .eq('email', email)
      .eq('product_id', body.productId)
      .eq('size', body.size)
      .eq('notified', false)
      .maybeSingle()

    if (existing) {
      timer.end()
      return json({ 
        success: true, 
        message: 'You\'re already on the waitlist for this item!' 
      }, 200, corsHeaders)
    }

    // Insert back-in-stock request
    const { error } = await supabase
      .from('back_in_stock_requests')
      .insert({
        email,
        product_id: body.productId,
        size: body.size,
        notified: false,
      })

    if (error) {
      console.error('Failed to save back-in-stock request:', error)
      timer.end()
      return json({ error: 'Failed to save your request. Please try again.' }, 500, corsHeaders)
    }

    timer.end()
    return json({ 
      success: true, 
      message: `We'll notify you when ${product.name} in size ${body.size} is back in stock!` 
    }, 200, corsHeaders)
  } catch (err) {
    console.error('Back-in-stock error:', err)
    timer.end()
    return json({ error: 'Something went wrong processing your request.' }, 500, getCorsHeaders(req))
  }
})

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}