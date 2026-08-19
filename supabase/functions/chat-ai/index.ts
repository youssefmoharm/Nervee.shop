// supabase/functions/chat-ai/index.ts
//
// AI-powered chatbot using Google Gemini (generative language API).
// Handles conversations, order tracking, and intelligent responses.
// Escalates to human support when needed.
//
// Requires the GEMINI_API_KEY secret (set as OPENAI_API_KEY for backwards-
// compatibility with the existing secret name).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'
import { PerformanceTimer, logEvent } from '../_shared/monitoring.ts'

const GEMINI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-3.6-flash'

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
        if (!GEMINI_API_KEY) {
            console.error('OPENAI_API_KEY not set')
            timer.end()
            return json({ error: 'AI service not configured' }, 500)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        let body: ChatRequest
        try {
            body = (await req.json()) as ChatRequest
        } catch (e) {
            timer.end()
            return json({ error: 'Invalid request body' }, 400)
        }
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

        // Build messages for Gemini
        const conversationHistory = [
            ...((messages || []).map((m) => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.content,
            })) as any[]),
            { role: 'user', content: message },
        ]

        // Call the Gemini API
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
                ai_model: GEMINI_MODEL,
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
        console.error('Chat AI error:', err instanceof Error ? { msg: err.message, stack: err.stack } : String(err))
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

// Call the Gemini API. Messages are translated from the OpenAI-style
// {role, content} shape used upstream into Gemini's {role, parts:[{text}]}
// shape. `system` role is sent via systemInstruction; user/assistant become
// chat turns.
async function callOpenAI(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>
): Promise<{ response: string; tokensUsed: number } | null> {
    try {
        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }))

        const response = await fetch(
            `${GEMINI_API_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    },
                }),
            }
        )

        if (!response.ok) {
            const error = await response.text()
            console.error('Gemini error:', error)
            return null
        }

        const raw = await response.text()
        let data: any
        try {
            data = JSON.parse(raw)
        } catch (e) {
            console.error('GEMINI_RAW_BODY status', response.status, 'body_starts', JSON.stringify(raw.slice(0, 200)))
            throw new Error(`Gemini returned non-JSON (HTTP ${response.status}): ${raw.slice(0, 200)}`)
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
            console.error('Gemini: no response text', JSON.stringify(data).slice(0, 500))
            return null
        }

        return {
            response: text,
            tokensUsed: data.usageMetadata?.totalTokenCount ?? 0,
        }
    } catch (err) {
        console.error('Gemini API call failed:', err)
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
