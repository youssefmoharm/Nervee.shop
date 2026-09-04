import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Bot, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logError } from '../lib/sentry';
import { useToast } from '../context/ToastContext';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  typing?: boolean;
}

interface ChatbotProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatbotAI({ isOpen, onClose }: ChatbotProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showEscalation, setShowEscalation] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          text: "Hi! I'm NERVE's AI assistant. I can help you with orders, shipping, returns, products, and more. What can I help you with today?",
          sender: 'bot',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputText.trim();
    if (!text || isLoading) return;

    const userEmail = user?.email || 'guest@nerve.com';
    const customerName = user?.user_metadata?.first_name || 'Customer';

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Call AI chat function
      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          conversationId,
          email: userEmail,
          customerName,
          message: text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Set conversation ID from first response
      if (!conversationId) {
        setConversationId(data.conversationId);
      }

      // Check if escalation is needed
      if (data.requiresEscalation) {
        setShowEscalation(true);
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);

      // If escalation needed, show suggestion
      if (data.requiresEscalation) {
        const escalationMsg: Message = {
          id: (Date.now() + 2).toString(),
          text: 'It looks like this issue might benefit from personalized support. Would you like me to create a support ticket?',
          sender: 'bot',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, escalationMsg]);
      }
    } catch (error) {
      logError('Chat error:', error);
      showToast('Failed to send message. Please try again.', 'error');

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble responding right now. Please try again or contact us directly at support@nerveey.shop",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!conversationId || !ticketSubject) {
      showToast('Please enter a subject for your support ticket', 'error');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-support-ticket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          email: user?.email || 'guest@nerve.com',
          customerName: user?.user_metadata?.first_name || 'Customer',
          subject: ticketSubject,
          description: messages.map(m => `${m.sender}: ${m.text}`).join('\n'),
          priority: 'normal',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      showToast(`Support ticket ${data.ticketNumber} created! We'll be in touch soon.`, 'success');
      setShowEscalation(false);
      setTicketSubject('');

      const ticketMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: `Thank you! Support ticket #${data.ticketNumber} has been created. Our team will review your issue and respond within 24 hours. You can track your ticket from your account page.`,
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, ticketMsg]);
    } catch (error) {
      logError('Ticket creation error:', error);
      showToast('Failed to create support ticket. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-80 h-[500px] bg-white border border-navy/10 rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy/10 bg-navy text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bot size={16} />
          </div>
          <div>
            <h3 className="font-medium text-sm">NERVE AI Support</h3>
            <p className="text-xs text-white/80">Powered by GPT-4</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.sender === 'bot' && (
              <div className="w-6 h-6 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Bot size={12} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                message.sender === 'user' ? 'bg-navy text-white' : 'bg-gray-100 text-black'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
              <p className="text-xs mt-1 opacity-60">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            {message.sender === 'user' && (
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User size={12} className="text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Escalation Form */}
      {showEscalation && (
        <div className="px-4 py-3 border-t border-gray-200 bg-yellow-50">
          <div className="flex gap-2 mb-3">
            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-yellow-800">Need personalized help?</p>
              <p className="text-xs text-yellow-700 mt-1">
                Create a support ticket and our team will assist you directly.
              </p>
            </div>
          </div>
          <input
            type="text"
            value={ticketSubject}
            onChange={e => setTicketSubject(e.target.value)}
            placeholder="What's your issue about?"
            className="w-full text-xs border border-yellow-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:border-yellow-400"
            disabled={isLoading}
          />
          <button
            onClick={handleCreateTicket}
            disabled={!ticketSubject || isLoading}
            className="w-full bg-yellow-600 text-white text-xs py-1.5 rounded hover:bg-yellow-700 transition-colors disabled:opacity-50"
          >
            Create Support Ticket
          </button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-navy/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 border border-navy/20 rounded-lg px-3 py-2 text-sm text-black focus:outline-none focus:border-navy"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-navy text-white p-2 rounded-lg hover:bg-navy-2 transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}

// Chatbot trigger button
interface ChatbotTriggerProps {
  onClick: () => void;
}

export function ChatbotAITrigger({ onClick }: ChatbotTriggerProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[80] w-12 h-12 bg-navy text-white rounded-full shadow-lg hover:bg-navy-2 transition-all hover:scale-110 flex items-center justify-center"
      aria-label="Open AI chat support"
    >
      <MessageCircle size={20} />
    </button>
  );
}
