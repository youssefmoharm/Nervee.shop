import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Send, User, Bot } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
  typing?: boolean
}

interface ChatbotProps {
  isOpen: boolean
  onClose: () => void
}

const FAQ_RESPONSES: Record<string, string> = {
  // Shipping & Delivery
  'shipping': 'We offer standard delivery (2-5 business days) and express delivery (next day) across Egypt. Shipping costs vary by location and order value.',
  'delivery': 'Standard delivery takes 2-5 business days. Express delivery is available for next-day delivery in Cairo and Alexandria.',
  'track': 'You can track your order from your account page under "Order History" or use the tracking link sent to your email.',
  
  // Returns & Exchanges
  'return': 'We offer free returns within 14 days of delivery. Items must be unworn with tags attached. Visit our Returns page for more details.',
  'exchange': 'Exchanges are available within 14 days. You can exchange for a different size or color based on availability.',
  'refund': 'Refunds are processed within 5-7 business days after we receive your returned item.',
  
  // Products & Sizing
  'size': 'Check our size guide on each product page. NERVE fits true to size unless noted. If between sizes, size up for oversized look.',
  'sizing': 'Our size guide shows measurements for each item. For the best fit, measure yourself and compare with our guide.',
  'material': 'We use premium cotton, sustainable denim, and high-quality fabrics. Material details are listed on each product page.',
  
  // Orders & Payment
  'payment': 'We accept credit/debit cards through Paymob and cash on delivery (COD) for orders under EGP 2000.',
  'order': 'You can view and manage your orders from your account page. Order confirmation is sent to your email.',
  'cancel': 'Orders can be cancelled within 2 hours of placement. Contact us immediately if you need to cancel.',
  
  // Account & Support
  'account': 'Create an account to track orders, save addresses, and access your wishlist. Sign up takes just a minute!',
  'password': 'You can reset your password from the login page or change it in your account settings.',
  'contact': 'You can reach us via this chat, email at support@nerve.store, or through our contact page.',
}

const GREETING_MESSAGES = [
  "Hi! I'm NERVE's virtual assistant. How can I help you today?",
  "Welcome to NERVE! I'm here to help with any questions about our products, orders, or policies.",
  "Hello! Need help with sizing, shipping, or returns? I'm here to assist!",
]

const QUICK_ACTIONS = [
  { label: '📦 Track Order', keywords: ['track', 'order', 'delivery'] },
  { label: '📏 Size Guide', keywords: ['size', 'sizing', 'fit'] },
  { label: '🔄 Returns', keywords: ['return', 'exchange', 'refund'] },
  { label: '🚚 Shipping Info', keywords: ['shipping', 'delivery', 'cost'] },
]

export default function Chatbot({ isOpen, onClose }: ChatbotProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize chat with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greeting = GREETING_MESSAGES[Math.floor(Math.random() * GREETING_MESSAGES.length)]
      setMessages([{
        id: '1',
        text: greeting,
        sender: 'bot',
        timestamp: new Date(),
      }])
    }
  }, [isOpen])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Get bot response based on user message
  const getBotResponse = (userMessage: string): string => {
    const message = userMessage.toLowerCase().trim()
    
    // Check for greeting
    if (message.match(/^(hi|hello|hey|good morning|good afternoon)/i)) {
      return `Hi ${user?.user_metadata?.first_name || 'there'}! How can I help you today?`
    }
    
    // Check for thanks
    if (message.match(/(thanks|thank you|appreciate)/i)) {
      return "You're welcome! Is there anything else I can help you with?"
    }
    
    // Find matching FAQ response
    for (const [keyword, response] of Object.entries(FAQ_RESPONSES)) {
      if (message.includes(keyword)) {
        return response
      }
    }
    
    // Check for specific product questions
    if (message.includes('tee') || message.includes('t-shirt')) {
      return "Our tees are made from premium cotton and fit true to size. Check the size guide on the product page for exact measurements."
    }
    
    if (message.includes('hoodie')) {
      return "Our hoodies are designed for a relaxed fit. They're made from soft cotton blend fabric. Size up if you prefer an oversized look."
    }
    
    if (message.includes('denim') || message.includes('jeans')) {
      return "Our denim is made from sustainable raw indigo and washed black options. They have a modern fit - check the size guide for measurements."
    }
    
    // Default response
    return "I'd be happy to help! You can ask me about:\n• Order tracking and delivery\n• Size guides and product info\n• Returns and exchanges\n• Payment methods\n\nOr contact our team at support@nerve.store for detailed assistance."
  }

  // Send message
  const sendMessage = async (messageText?: string) => {
    const text = messageText || inputText.trim()
    if (!text) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsTyping(true)

    // Simulate typing delay
    setTimeout(() => {
      const botResponse = getBotResponse(text)
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, botMessage])
      setIsTyping(false)
    }, 1000 + Math.random() * 1000) // 1-2 second delay
  }

  // Handle quick action click
  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    const keyword = action.keywords[0]
    sendMessage(keyword)
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage()
  }

  if (!isOpen) return null

  return (
    <div className="fixed bottom-4 right-4 z-[90] w-80 h-96 bg-white border border-navy/10 rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-navy/10 bg-navy text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Bot size={16} />
          </div>
          <div>
            <h3 className="font-medium text-sm">NERVE Assistant</h3>
            <p className="text-xs text-white/80">Usually replies in minutes</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
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
                message.sender === 'user'
                  ? 'bg-navy text-white'
                  : 'bg-gray-100 text-navy'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
              <p className="text-xs mt-1 opacity-60">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-6 h-6 bg-navy rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-navy/60 mb-2">Quick help:</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                className="text-xs bg-gray-50 hover:bg-gray-100 px-2 py-1.5 rounded text-left transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-navy/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border border-navy/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="bg-navy text-white p-2 rounded-lg hover:bg-navy-2 transition-colors disabled:opacity-50"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  )
}

// Chatbot trigger button
interface ChatbotTriggerProps {
  onClick: () => void
}

export function ChatbotTrigger({ onClick }: ChatbotTriggerProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 z-[80] w-12 h-12 bg-navy text-white rounded-full shadow-lg hover:bg-navy-2 transition-all hover:scale-110 flex items-center justify-center"
      aria-label="Open chat support"
    >
      <MessageCircle size={20} />
    </button>
  )
}