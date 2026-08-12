// supabase/functions/handle-unsubscribe/index.ts
//
// Handles one-click unsubscribe from email links
// Validates token, updates newsletter status, logs action
// Returns success page with option to resubscribe

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

serve(async (req) => {
    const timer = new PerformanceTimer('handle-unsubscribe')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        timer.end()
        return json({ error: 'Method not allowed' }, 405)
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body = await req.json()
        const { token, reason } = body

        if (!token || typeof token !== 'string') {
            timer.end()
            return json({ error: 'Token is required' }, 400)
        }

        // Get client info for audit log
        const userAgent = req.headers.get('user-agent') || 'unknown'
        const ip =
            req.headers.get('x-forwarded-for') ||
            req.headers.get('cf-connecting-ip') ||
            'unknown'

        // Call RPC to process unsubscribe
        const { data: result, error } = await supabase.rpc('process_unsubscribe', {
            p_token: token.trim(),
            p_user_agent: userAgent,
            p_ip_address: ip,
            p_reason: reason || null,
        })

        if (error) {
            console.error('Unsubscribe error:', error)
            timer.end()
            return json({ success: false, error: error.message }, 400)
        }

        if (!result.success) {
            logEvent({
                type: 'warning',
                category: 'UNSUBSCRIBE',
                message: result.error,
                data: { reason_given: reason },
            })
            timer.end()
            return json(result, 400)
        }

        logEvent({
            type: 'info',
            category: 'UNSUBSCRIBE',
            message: `Email unsubscribed: ${result.email}`,
            data: {
                email: result.email,
                unsubscribed_from: result.unsubscribed_from,
                reason: reason || 'no reason provided',
            },
        })

        timer.end()
        return json(result)
    } catch (err) {
        console.error('Unsubscribe handler error:', err)
        timer.end()
        return json({ error: 'Failed to process unsubscribe', details: (err as Error).message }, 500)
    }
})

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}
