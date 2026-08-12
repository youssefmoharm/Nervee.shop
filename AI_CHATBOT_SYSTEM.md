# 🤖 NERVE AI Chatbot System - Complete Implementation

**Production-ready AI chatbot with OpenAI GPT-4, intelligent order tracking, and escalation to human support.**

---

## ✅ What's Included

### 1. Database Schema (Migration 010)
- **chat_conversations** - Track conversation history and metadata
- **chat_messages** - Store all messages with AI confidence scores
- **support_tickets** - Professional ticket management system
- **ticket_responses** - Support team responses
- **ai_context_cache** - Cache customer data for AI context
- Full RLS policies + audit logging

### 2. AI Backend (3 Edge Functions)
- **chat-ai** - OpenAI GPT-4 integration with order context
- **create-support-ticket** - Escalation to human support
- **handle-unsubscribe** - (Already built)

### 3. Frontend (React Component)
- **ChatbotAI.tsx** - Modern AI-powered chat UI
- Beautiful design, mobile responsive
- Auto-escalation interface
- Real-time typing indicators

### 4. Features
- ✅ Order tracking (real data from DB)
- ✅ Shipping inquiries
- ✅ Returns/exchanges info
- ✅ Product questions
- ✅ Automatic escalation to support tickets
- ✅ Conversation history
- ✅ Customer context awareness

---

## 🚀 Deployment (10 minutes)

### Step 1: Set OpenAI Key (1 min)
```bash
supabase secrets set OPENAI_API_KEY=sk_your_key_here
```

Get key from: https://platform.openai.com/api-keys

### Step 2: Run Migration (2 min)
```bash
supabase migration up  # Runs migration 010
```

### Step 3: Deploy Edge Functions (2 min)
```bash
supabase functions deploy chat-ai --no-verify
supabase functions deploy create-support-ticket --no-verify
```

### Step 4: Replace Chatbot Component (30 sec)
Already done in `src/App.tsx` - uses ChatbotAI instead of Chatbot

### Step 5: Test (5 min)
- Open chat
- Ask "What's the status of my order?"
- Try "I want to return my shirt"
- Test escalation: Click "Create Support Ticket"

---

## 📊 How It Works

```
User types message
  ↓
ChatbotAI component sends to chat-ai function
  ↓
chat-ai function:
  1. Gets conversation ID (creates if new)
  2. Retrieves customer context (recent orders, tickets)
  3. Gets conversation history (last 10 messages)
  4. Builds system prompt with context
  5. Calls OpenAI GPT-4 API
  6. Saves messages to database
  7. Detects topic automatically
  8. Checks if escalation needed
  ↓
Response sent back to UI
  ↓
If escalation needed:
  - Show ticket creation form
  - User enters subject
  - Click "Create Support Ticket"
  ↓
create-support-ticket function:
  1. Validates ticket data
  2. Creates ticket record
  3. Updates conversation
  4. Sends confirmation email
  5. Returns ticket number
  ↓
User sees confirmation with ticket number
```

---

## 🧠 AI Context

The AI knows:
- Customer's recent orders (status, dates, amounts)
- Open support tickets
- Order history
- Customer email & name

This allows intelligent responses like:
- "Your order #12345 shipped yesterday and should arrive by Friday"
- "I see you have an open ticket #TKT-2024-12345 from yesterday"
- "You haven't placed any orders yet, but I can help you find something!"

---

## 🔐 Security

- ✅ RLS policies restrict data access
- ✅ OpenAI key stored in secrets (not in code)
- ✅ Rate limiting on all functions
- ✅ Input validation on all endpoints
- ✅ Audit logging of conversations
- ✅ Ticket system fully permissioned

---

## 📁 Files Created/Modified

### New Files
1. `supabase/migrations/010_chatbot_system.sql` - Database schema
2. `supabase/functions/chat-ai/index.ts` - AI engine
3. `supabase/functions/create-support-ticket/index.ts` - Ticket creation
4. `src/components/ChatbotAI.tsx` - UI component
5. `AI_CHATBOT_SYSTEM.md` - This documentation

### Modified Files
1. `src/App.tsx` - Replaced Chatbot with ChatbotAI

---

## 📖 Database Schema

### chat_conversations
```sql
id (UUID)
user_id (UUID) - NULL for guests
email (TEXT)
customer_name (TEXT)
status (TEXT) - 'active', 'closed', 'waiting_for_response'
topic (TEXT) - Auto-detected
sentiment (TEXT) - 'positive', 'neutral', 'negative'
escalated_to_ticket_id (UUID)
human_handoff_at (TIMESTAMPTZ)
message_count (INTEGER)
first_message_at (TIMESTAMPTZ)
last_message_at (TIMESTAMPTZ)
created_at, updated_at
```

### chat_messages
```sql
id (UUID)
conversation_id (UUID) - FK
sender (TEXT) - 'user', 'ai', 'human'
content (TEXT)
ai_model (TEXT) - 'gpt-4', 'gpt-3.5-turbo'
ai_confidence (DECIMAL) - 0.00 to 1.00
tokens_used (INTEGER)
created_at, processed_at
```

### support_tickets
```sql
id (UUID)
ticket_number (TEXT) - TKT-2024-XXXXX
conversation_id (UUID) - FK (from chat)
user_id (UUID), email (TEXT), customer_name (TEXT)
subject (TEXT), description (TEXT)
status (TEXT) - 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
priority (TEXT) - 'urgent', 'normal', 'low'
assigned_to (TEXT) - Admin name
created_at, first_response_at, resolved_at, updated_at
```

### ticket_responses
```sql
id (UUID)
ticket_id (UUID) - FK
sender_type (TEXT) - 'customer', 'admin'
sender_email, sender_name (TEXT)
message (TEXT)
attachments (TEXT[])
created_at, updated_at
```

---

## 🧪 Testing

### Manual Test

1. Open chat
2. Ask: "Can you track my order?"
3. Expected: AI asks for order number or shows recent orders
4. Ask: "I want to return my shirt"
5. Expected: AI explains return policy
6. Ask: "I have a complex issue I need help with"
7. Expected: "Would you like to create a support ticket?" appears
8. Click "Create Support Ticket"
9. Enter subject: "Custom T-shirt color issue"
10. Click button
11. Expected: Confirmation email + ticket number shown

### Database Verification
```sql
-- Check conversations
SELECT * FROM chat_conversations ORDER BY created_at DESC LIMIT 5;

-- Check messages
SELECT sender, content FROM chat_messages ORDER BY created_at DESC LIMIT 10;

-- Check tickets
SELECT ticket_number, status FROM support_tickets ORDER BY created_at DESC LIMIT 5;

-- Check ticket responses
SELECT * FROM ticket_responses ORDER BY created_at DESC LIMIT 5;
```

---

## 💰 Costs

### OpenAI API
- GPT-4: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- Average message: 200 input + 100 output tokens = ~$0.009 per message
- 1000 chats/month = ~$9/month

### Supabase
- Edge functions: Included in Pro plan
- Database: Minimal (messages are text)

### Total
- **~$10/month** for 1000+ chats

---

## 🎯 Key Features

| Feature | Status | Details |
|---------|--------|---------|
| GPT-4 AI | ✅ | Real conversations, not keyword matching |
| Order tracking | ✅ | Shows real order data from database |
| Conversation history | ✅ | Uses last 10 messages for context |
| Auto-escalation | ✅ | Detects when human needed |
| Support tickets | ✅ | Professional ticket system |
| Ticket notifications | ✅ | Email confirmation sent |
| Sentiment detection | 🟡 | Ready (not yet implemented) |
| Rating system | 🟡 | Ready (not yet implemented) |
| Knowledge base | 🟡 | Can be added via system prompt |
| Admin dashboard | 🟡 | Can be built |

---

## 🔧 Configuration

### System Prompt Customization

Edit `supabase/functions/chat-ai/index.ts` function `buildSystemPrompt()` to:
- Add specific business rules
- Include product categories
- Add custom policies
- Adjust tone

Example:
```typescript
const systemPrompt = `You are NERVE's support AI...
Additional guidelines:
- Always mention our 14-day return policy
- Recommend size up for oversized fit
- Mention sustainable materials when relevant
`
```

### Topic Detection

Edit `detectTopic()` function to match your topics:
```typescript
if (combined.includes('bulk') || combined.includes('wholesale')) return 'wholesale'
if (combined.includes('vip')) return 'premium_support'
```

---

## 📊 Analytics Queries

### Chat volume by day
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as conversations,
  SUM(message_count) as total_messages
FROM chat_conversations
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### Escalation rate
```sql
SELECT 
  COUNT(*) as total_conversations,
  COUNT(NULLIF(escalated_to_ticket_id, NULL)) as escalated,
  ROUND(100.0 * COUNT(NULLIF(escalated_to_ticket_id, NULL)) / COUNT(*), 2) as escalation_rate
FROM chat_conversations;
```

### Topics discussed
```sql
SELECT 
  topic,
  COUNT(*) as count
FROM chat_conversations
WHERE topic IS NOT NULL
GROUP BY topic
ORDER BY count DESC;
```

### Ticket status
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(AVG(EXTRACT(HOUR FROM (COALESCE(resolved_at, NOW()) - created_at))), 1) as avg_hours_to_resolve
FROM support_tickets
GROUP BY status;
```

---

## 🚨 Troubleshooting

### "AI service not configured"
- Check OPENAI_API_KEY secret is set
- Verify it's valid: https://platform.openai.com/api-keys

### Chat not responding
- Check Edge Function logs: Supabase > Edge Functions > chat-ai
- Verify OpenAI account has credits
- Check rate limits

### Tickets not creating
- Check Edge Function logs: Supabase > Edge Functions > create-support-ticket
- Verify conversation exists in database
- Check RLS policies

### Orders not showing in context
- Verify orders exist for customer email
- Check get_ai_context() function
- Run manual query: SELECT * FROM orders WHERE email = 'user@example.com';

---

## 🎓 Advanced Customization

### Add Knowledge Base

Create a `kb_articles` table:
```sql
CREATE TABLE kb_articles (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ
);
```

Then in system prompt:
```typescript
const knowledgeBase = await supabase
  .rpc('search_kb', { p_query: userMessage })

const systemPrompt = `...
KNOWLEDGE BASE:
${knowledgeBase.map(article => `${article.title}: ${article.content}`).join('\n')}
`
```

### Add Sentiment Analysis

```typescript
const sentiment = await analyzeSentiment(message)
await updateConversationSentiment(conversationId, sentiment)

// Show different prompts based on sentiment
if (sentiment === 'negative') {
  systemPrompt += '\nCustomer seems frustrated - be extra helpful and apologetic'
}
```

### Add Customer Satisfaction Rating

```typescript
// After ticket resolved
const satisfactionForm = `
How satisfied were you with this support? ⭐⭐⭐⭐⭐
`
```

---

## 🔄 Integration with Admin Dashboard

Admin can see:
- Active conversations (by department)
- Pending escalations
- Ticket queue (by priority)
- Chat metrics
- AI performance

See: `Admin/ChatAnalytics.tsx` (ready to build)

---

## 📞 Support

For issues:
1. Check Edge Function logs
2. Verify OpenAI key is valid
3. Check database tables exist
4. Run verification queries
5. Test manually with curl

Example curl test:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/chat-ai \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "customerName": "John",
    "message": "Can you track my order?"
  }'
```

---

## ✨ Status

**PRODUCTION READY** ✅

- ✅ AI integration complete
- ✅ Database schema complete
- ✅ Ticket system complete
- ✅ Frontend UI complete
- ✅ Security implemented
- ✅ Documentation complete

**Ready to deploy and serve real customers** 🚀
