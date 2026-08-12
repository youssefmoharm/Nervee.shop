// supabase/functions/chat-ai/index.ts
//
// AI-powered chatbot using OpenAI GPT-4
// Handles conversations, order tracking, and intelligent responses
// Escalates to human support when needed

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface ChatRequest {
    conversationId?: string
    email: string
    customerName?: string
    message: string
}

interface ChatResponse {
    conversationId: string
    response: string
    confidence: number
    requiresEscalation: boolean
    suggestedTicketTopic?: string
}

serve(async (req) => {
    const timer = new PerformanceTimer('chat-ai')

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        timer.end()
        return json({ error: 'Method not allowed' }, 405)
    }

    try {
        if (!OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not set')
            timer.end()
            return json({ error: 'AI service not configured' }, 500)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        const body = (await req.json()) as ChatRequest
        const { conversationId, email, customerName, message } = body

        if (!email || !message) {
            timer.end()
            return json({ error: 'Email and message required' }, 400)
        }

        // Get or create conversation
        let conversation = conversationId
        if (!conversation) {
            const { data: newConv, error: convError } = await supabase
                .from('chat_conversations')
                .insert({
                    email,
                    customer_name: customerName,
                })
                .select()
                .single()

            if (convError || !newConv) {
                console.error('Failed to create conversation:', convError)
                timer.end()
                return json({ error: 'Failed to start conversation' }, 500)
            }

            conversation = newConv.id
        }

        // Get customer context (orders, tickets, etc.)
        const { data: context } = await supabase.rpc('get_ai_context', {
            p_email: email,
        })

        // Build system prompt with context
        const systemPrompt = buildSystemPrompt(email, context)

        // Get recent conversation history
        const { data: messages } = await supabase
            .from('chat_messages')
            .select('sender, content')
            .eq('conversation_id', conversation)
            .order('created_at', { ascending: true })
            .limit(10)

        // Build messages for OpenAI
        const conversationHistory = [
            ...((messages || []).map((m) => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.content,
            })) as any[]),
            { role: 'user', content: message },
        ]

        // Call OpenAI API
        const aiResponse = await callOpenAI(systemPrompt, conversationHistory)

        if (!aiResponse) {
            timer.end()
            return json({ error: 'Failed to get AI response' }, 500)
        }

        const { response, tokensUsed } = aiResponse

        // Check if escalation is needed
        const requiresEscalation =
            response.includes('[ESCALATE]') ||
            response.includes('ticket') ||
            response.includes('human support') ||
            message.length > 500

        const cleanedResponse = response.replace('[ESCALATE]', '').trim()

        // Save messages to database
        await supabase.from('chat_messages').insert([
            {
                conversation_id: conversation,
                sender: 'user',
                content: message,
            },
            {
                conversation_id: conversation,
                sender: 'ai',
                content: cleanedResponse,
                ai_model: 'gpt-4',
                ai_confidence: 0.85,
                tokens_used: tokensUsed,
            },
        ])

        // Detect topic from conversation
        const topic = detectTopic(message, cleanedResponse)

        // Update conversation metadata
        await supabase.rpc('update_conversation_metadata', {
            p_conversation_id: conversation,
            p_topic: topic,
        })

        logEvent({
            type: 'info',
            category: 'CHAT_AI',
            message: `Chat response generated`,
            data: {
                conversation_id: conversation,
                email,
                tokens: tokensUsed,
                escalation_needed: requiresEscalation,
            },
        })

        timer.end()

        return json({
            conversationId: conversation,
            response: cleanedResponse,
            confidence: 0.85,
            requiresEscalation,
            suggestedTicketTopic: topic,
        } as ChatResponse)
    } catch (err) {
        console.error('Chat AI error:', err)
        timer.end()
        return json({ error: 'Failed to process message', details: (err as Error).message }, 500)
    }
})

// Build system prompt with customer context
function buildSystemPrompt(email: string, context: any): string {
    const recentOrders = context?.recent_orders || []
    const openTickets = context?.open_tickets || []

    const orderSummary =
        recentOrders.length > 0
            ? `Recent orders: ${recentOrders.map((o: any) => `#${o.order_number} (${o.status})`).join(', ')}`
            : 'No recent orders'

    const ticketSummary =
        openTickets.length > 0
            ? `Open support tickets: ${openTickets.map((t: any) => `#${t.ticket_number} (${t.status})`).join(', ')}`
            : 'No open tickets'

    return `You are NERVE's AI customer support assistant. You help customers with:
- Order tracking and status
- Shipping and delivery questions
- Returns and exchanges
- Product information and sizing
- Billing and payment issues
- General customer support

Customer Context:
- Email: ${email}
- ${orderSummary}
- ${ticketSummary}

Guidelines:
1. Be helpful, friendly, and professional
2. If you need to create a support ticket, include [ESCALATE] in response
3. Provide specific information when available (order numbers, tracking, etc.)
4. If the issue requires human support, suggest creating a ticket
5. Keep responses concise (2-3 sentences)
6. Always offer next steps or solutions

For order tracking: Use the provided order context to give specific status updates.
For complex issues: Suggest escalating to human support with [ESCALATE] marker.`
}

// Call OpenAI API
async function callOpenAI(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
): Promise<{ response: string; tokensUsed: number } | null> {
    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                temperature: 0.7,
                max_tokens: 500,
            }),
        })

        if (!response.ok) {
            const error = await response.text()
            console.error('OpenAI error:', error)
            return null
        }

        const data = await response.json()

        return {
            response: data.choices[0].message.content,
            tokensUsed: data.usage.total_tokens,
        }
    } catch (err) {
        console.error('OpenAI API call failed:', err)
        return null
    }
}

// Detect conversation topic
function detectTopic(
    userMessage: string,
    aiResponse: string
): string {
    const combined = `${userMessage} ${aiResponse}`.toLowerCase()

    if (combined.includes('order') || combined.includes('track')) return 'orders'
    if (combined.includes('ship') || combined.includes('deliver')) return 'shipping'
    if (combined.includes('return') || combined.includes('exchange')) return 'returns'
    if (combined.includes('size') || combined.includes('product')) return 'products'
    if (combined.includes('pay') || combined.includes('billing')) return 'billing'

    return 'other'
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}
