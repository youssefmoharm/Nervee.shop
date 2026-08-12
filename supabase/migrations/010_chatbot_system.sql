-- NERVE AI Chatbot System
-- Database schema for conversation history, tickets, and support management

-- ============================================================================
-- CHAT CONVERSATIONS TABLE
-- ============================================================================
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL, -- For guests
  customer_name TEXT,
  
  -- Conversation metadata
  status TEXT DEFAULT 'active', -- 'active', 'closed', 'waiting_for_response'
  topic TEXT, -- 'orders', 'shipping', 'returns', 'products', 'billing', 'other'
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  
  -- Escalation tracking
  escalated_to_ticket_id UUID,
  human_handoff_at TIMESTAMPTZ,
  
  -- Metrics
  message_count INTEGER DEFAULT 0,
  first_message_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('active', 'closed', 'waiting_for_response')),
  CONSTRAINT valid_topic CHECK (topic IN ('orders', 'shipping', 'returns', 'products', 'billing', 'other'))
);

CREATE INDEX chat_conversations_user_id_idx ON chat_conversations(user_id);
CREATE INDEX chat_conversations_email_idx ON chat_conversations(email);
CREATE INDEX chat_conversations_status_idx ON chat_conversations(status);
CREATE INDEX chat_conversations_created_at_idx ON chat_conversations(created_at DESC);

-- ============================================================================
-- CHAT MESSAGES TABLE
-- ============================================================================
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  
  -- Message details
  sender TEXT NOT NULL, -- 'user', 'ai', 'human'
  content TEXT NOT NULL,
  
  -- AI metadata
  ai_model TEXT, -- 'gpt-4', 'gpt-3.5-turbo', etc.
  ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
  tokens_used INTEGER,
  
  -- Processing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_sender CHECK (sender IN ('user', 'ai', 'human')),
  CONSTRAINT valid_confidence CHECK (ai_confidence >= 0 AND ai_confidence <= 1)
);

CREATE INDEX chat_messages_conversation_id_idx ON chat_messages(conversation_id);
CREATE INDEX chat_messages_sender_idx ON chat_messages(sender);
CREATE INDEX chat_messages_created_at_idx ON chat_messages(created_at DESC);

-- ============================================================================
-- SUPPORT TICKETS TABLE
-- ============================================================================
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  
  -- Ticket info
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  customer_name TEXT,
  
  -- Content
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'urgent', 'normal', 'low'
  topic TEXT, -- Same as chat topic
  
  -- Status tracking
  status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
  priority TEXT DEFAULT 'normal', -- 'urgent', 'normal', 'low'
  assigned_to TEXT, -- Admin username or email
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  CONSTRAINT valid_priority CHECK (priority IN ('urgent', 'normal', 'low'))
);

CREATE INDEX support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX support_tickets_email_idx ON support_tickets(email);
CREATE INDEX support_tickets_status_idx ON support_tickets(status);
CREATE INDEX support_tickets_priority_idx ON support_tickets(priority);
CREATE INDEX support_tickets_created_at_idx ON support_tickets(created_at DESC);
CREATE INDEX support_tickets_ticket_number_idx ON support_tickets(ticket_number);

-- ============================================================================
-- TICKET RESPONSES TABLE
-- ============================================================================
CREATE TABLE ticket_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  
  -- Response info
  sender_type TEXT NOT NULL, -- 'customer', 'admin'
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  
  -- Content
  message TEXT NOT NULL,
  
  -- Attachments (URLs)
  attachments TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_sender_type CHECK (sender_type IN ('customer', 'admin'))
);

CREATE INDEX ticket_responses_ticket_id_idx ON ticket_responses(ticket_id);
CREATE INDEX ticket_responses_sender_type_idx ON ticket_responses(sender_type);
CREATE INDEX ticket_responses_created_at_idx ON ticket_responses(created_at DESC);

-- ============================================================================
-- AI CONTEXT CACHE (for order/customer lookups)
-- ============================================================================
CREATE TABLE ai_context_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  
  -- What we know about the customer
  customer_email TEXT,
  customer_id UUID,
  
  -- Cached data
  recent_orders JSONB, -- Last 3-5 orders
  open_tickets JSONB, -- Active support tickets
  customer_preferences JSONB, -- Newsletter, product interests, etc.
  
  -- Cache metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  ttl INTEGER DEFAULT 3600, -- Time to live in seconds (1 hour)
  
  CONSTRAINT valid_ttl CHECK (ttl > 0)
);

CREATE INDEX ai_context_cache_conversation_id_idx ON ai_context_cache(conversation_id);
CREATE INDEX ai_context_cache_customer_id_idx ON ai_context_cache(customer_id);
CREATE INDEX ai_context_cache_last_updated_idx ON ai_context_cache(last_updated DESC);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_context_cache ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Chat conversations: users see own, admins see all
CREATE POLICY "Users can see own conversations" ON chat_conversations FOR SELECT USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Chat messages: users see own conversation messages, admins see all
CREATE POLICY "Users can see own messages" ON chat_messages FOR SELECT USING (
  conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM admin_users)
);

-- Support tickets: users see own, admins see all
CREATE POLICY "Users can see own tickets" ON support_tickets FOR SELECT USING (
  user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM admin_users)
);

CREATE POLICY "Users can create own tickets" ON support_tickets FOR INSERT WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);

-- Ticket responses: users see own tickets, admins see all
CREATE POLICY "Users can see ticket responses" ON ticket_responses FOR SELECT USING (
  ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.uid())
  OR auth.uid() IN (SELECT user_id FROM admin_users)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TKT-' || DATE_PART('year', NOW())::TEXT || 
         LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Create support ticket from chat
CREATE OR REPLACE FUNCTION create_ticket_from_chat(
  p_conversation_id UUID,
  p_subject TEXT,
  p_description TEXT,
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  v_ticket_id UUID;
  v_user_id UUID;
  v_email TEXT;
  v_customer_name TEXT;
BEGIN
  -- Get conversation details
  SELECT user_id, email, customer_name INTO v_user_id, v_email, v_customer_name
  FROM chat_conversations
  WHERE id = p_conversation_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  -- Create ticket
  INSERT INTO support_tickets (
    ticket_number,
    conversation_id,
    user_id,
    email,
    customer_name,
    subject,
    description,
    priority
  ) VALUES (
    generate_ticket_number(),
    p_conversation_id,
    v_user_id,
    v_email,
    v_customer_name,
    p_subject,
    p_description,
    p_priority
  ) RETURNING id INTO v_ticket_id;

  -- Update conversation
  UPDATE chat_conversations
  SET 
    escalated_to_ticket_id = v_ticket_id,
    status = 'waiting_for_response',
    human_handoff_at = NOW()
  WHERE id = p_conversation_id;

  RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- Mark conversation as closed
CREATE OR REPLACE FUNCTION close_conversation(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE chat_conversations
  SET status = 'closed', updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Update conversation metadata
CREATE OR REPLACE FUNCTION update_conversation_metadata(
  p_conversation_id UUID,
  p_topic TEXT DEFAULT NULL,
  p_sentiment TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE chat_conversations
  SET 
    topic = COALESCE(p_topic, topic),
    sentiment = COALESCE(p_sentiment, sentiment),
    updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Get customer context for AI
CREATE OR REPLACE FUNCTION get_ai_context(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
  v_customer_id UUID;
BEGIN
  -- Get customer ID from email
  SELECT id INTO v_customer_id
  FROM customers
  WHERE email = p_email
  LIMIT 1;

  -- Build context object
  v_context := jsonb_build_object(
    'email', p_email,
    'customer_id', v_customer_id,
    'recent_orders', (
      SELECT jsonb_agg(jsonb_build_object(
        'order_number', order_number,
        'total', total,
        'status', status,
        'placed_at', placed_at
      )) FROM orders
      WHERE email = p_email OR customer_id = v_customer_id
      ORDER BY placed_at DESC
      LIMIT 5
    ),
    'open_tickets', (
      SELECT jsonb_agg(jsonb_build_object(
        'ticket_number', ticket_number,
        'subject', subject,
        'status', status
      )) FROM support_tickets
      WHERE email = p_email OR user_id = v_customer_id
      AND status != 'closed'
    )
  );

  RETURN v_context;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Active conversations
CREATE OR REPLACE VIEW active_conversations AS
SELECT 
  id,
  email,
  customer_name,
  topic,
  sentiment,
  message_count,
  last_message_at,
  created_at,
  EXTRACT(MINUTE FROM (NOW() - last_message_at)) as minutes_since_last_message
FROM chat_conversations
WHERE status = 'active'
ORDER BY last_message_at DESC;

-- Tickets needing attention
CREATE OR REPLACE VIEW tickets_needing_attention AS
SELECT 
  ticket_number,
  email,
  subject,
  priority,
  status,
  created_at,
  EXTRACT(HOUR FROM (NOW() - created_at)) as hours_since_created
FROM support_tickets
WHERE status IN ('open', 'waiting_customer')
ORDER BY priority DESC, created_at ASC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on support_tickets
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at on ticket_responses
CREATE TRIGGER update_ticket_responses_updated_at BEFORE UPDATE ON ticket_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update conversation timestamp on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET 
    last_message_at = NEW.created_at,
    message_count = message_count + 1,
    first_message_at = COALESCE(first_message_at, NEW.created_at),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_update_on_message AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();
