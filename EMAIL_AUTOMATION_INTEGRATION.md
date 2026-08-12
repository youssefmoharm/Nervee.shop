# Email Automation Integration Guide

## Quick Integration Checklist

This guide shows how to integrate email automation into your existing components and services.

---

## 1. Newsletter Component Integration

### Current Implementation
Your `Newsletter.tsx` already has a service layer. Update it to use the new email automation:

```typescript
// src/components/Newsletter.tsx
import { useState, type FormEvent } from 'react'
import { emailAutomation, isValidEmail } from '../lib/emailAutomation'
import { useToast } from '../context/ToastContext'

export default function Newsletter() {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [status, setStatus] = useState<'idle' | 'error' | 'loading' | 'success'>('idle')
  const { addToast } = useToast()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!isValidEmail(email)) {
      setStatus('error')
      addToast('Please enter a valid email', 'error')
      return
    }

    setStatus('loading')
    
    try {
      // Subscribe to newsletter (adds to DB + sends welcome email)
      const success = await emailAutomation.subscribeToNewsletter({
        email,
        firstName: firstName || undefined,
      })

      if (success) {
        setStatus('success')
        addToast('Welcome! Check your email for a special welcome offer', 'success')
        setEmail('')
        setFirstName('')
        
        // Reset success message after 5 seconds
        setTimeout(() => setStatus('idle'), 5000)
      } else {
        setStatus('error')
        addToast('Already subscribed or something went wrong', 'info')
      }
    } catch (error) {
      setStatus('error')
      addToast('Failed to subscribe. Please try again.', 'error')
    }
  }

  return (
    <section className="bg-navy py-20 md:py-28 px-5 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="nv-heading text-4xl md:text-6xl">Stay in the Loop</h2>
        <p className="text-silver mt-4 max-w-md mx-auto">
          Get early access to new drops, exclusive releases, and special offers.
        </p>

        {status === 'success' ? (
          <p className="mt-8 nv-eyebrow text-white">You're on the list. Welcome to NERVE.</p>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === 'error') setStatus('idle')
              }}
              placeholder="Enter your email"
              className="bg-transparent border border-white/30 px-5 py-3.5 text-sm w-full sm:w-80 focus:outline-none focus:border-white transition-colors placeholder:text-silver/60"
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              className="bg-white text-navy text-xs font-semibold tracking-widest2 uppercase px-8 py-3.5 hover:bg-mist transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Joining…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-3 text-xs text-red-300">Enter a valid email to join the list.</p>
        )}
      </div>
    </section>
  )
}
```

---

## 2. Cart Context - Track Abandonment

### Update CartContext to track activity

```typescript
// src/context/CartContext.tsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { emailAutomation } from '../lib/emailAutomation'
import { useAuth } from './AuthContext'

interface CartContextType {
  items: CartLine[]
  addItem: (item: CartLine) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
}

export const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([])
  const { user } = useAuth()

  // Track cart activity for abandonment emails
  useEffect(() => {
    if (!user || items.length === 0) return

    // Debounce cart tracking to avoid too many DB calls
    const timer = setTimeout(() => {
      const cartValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      emailAutomation.trackCartActivity(user.email, items, cartValue)
    }, 5000) // Wait 5 seconds after last change

    return () => clearTimeout(timer)
  }, [items, user])

  const addItem = useCallback((item: CartLine) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.size === item.size)
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && i.size === item.size
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }
      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    )
  }, [removeItem])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
```

---

## 3. Product Detail - Back in Stock Button

### Add back-in-stock notification to ProductDetail.tsx

```typescript
// In ProductDetail.tsx - add this section to the product details
import { emailAutomation } from '../lib/emailAutomation'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function ProductDetail() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [selectedSize, setSelectedSize] = useState('')
  const [requestingNotification, setRequestingNotification] = useState(false)

  // ... existing code ...

  const handleBackInStockRequest = async () => {
    if (!user) {
      addToast('Please sign in to request notifications', 'info')
      return
    }

    if (!selectedSize) {
      addToast('Please select a size first', 'error')
      return
    }

    setRequestingNotification(true)

    try {
      const success = await emailAutomation.requestBackInStockNotification(
        product.id,
        user.email,
        selectedSize
      )

      if (success) {
        addToast('📬 We\'ll notify you when this size is back in stock!', 'success')
      } else {
        addToast('Failed to set up notification', 'error')
      }
    } catch (error) {
      addToast('Something went wrong', 'error')
    } finally {
      setRequestingNotification(false)
    }
  }

  return (
    <div>
      {/* ... existing product info ... */}
      
      {/* If product is out of stock, show back-in-stock button */}
      {!inStock && (
        <button
          onClick={handleBackInStockRequest}
          disabled={requestingNotification || !user}
          className="w-full mt-4 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 disabled:opacity-60 transition"
        >
          {requestingNotification ? (
            'Setting up notification...'
          ) : (
            '🔔 Notify Me When Back in Stock'
          )}
        </button>
      )}
    </div>
  )
}
```

---

## 4. Checkout - Mark Cart as Recovered

### Update order completion to prevent abandonment emails

```typescript
// In your checkout/order completion flow
import { emailAutomation } from '../lib/emailAutomation'

async function handleOrderCompletion(order: Order) {
  // ... existing order logic ...

  // Mark cart as recovered to prevent abandonment emails
  if (order.email) {
    await emailAutomation.markCartAsRecovered(order.email)
  }

  // Clear cart
  clearCart()
  
  // Redirect to success page
  navigate(`/order-confirmation/${order.id}`)
}
```

---

## 5. Admin Dashboard - Email Analytics

### Create admin panel to view email metrics

```typescript
// src/pages/Admin/EmailAnalytics.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface EmailMetrics {
  totalSent: number
  totalFailed: number
  byType: { type: string; count: number }[]
  recentEmails: any[]
}

export default function EmailAnalytics() {
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      // Get email statistics
      const { data: emails } = await supabase
        .from('email_logs')
        .select('email_type, status')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      // Get newsletter subscribers
      const { data: subscribers } = await supabase
        .from('newsletter_subscribers')
        .select('id')
        .eq('is_active', true)

      // Get back-in-stock requests
      const { data: backInStock } = await supabase
        .from('back_in_stock_requests')
        .select('id')
        .eq('is_active', true)

      // Calculate metrics
      if (emails) {
        const byType: Record<string, number> = {}
        let totalSent = 0
        let totalFailed = 0

        emails.forEach((email) => {
          byType[email.email_type] = (byType[email.email_type] || 0) + 1
          if (email.status === 'sent') totalSent++
          if (email.status === 'failed') totalFailed++
        })

        setMetrics({
          totalSent,
          totalFailed,
          byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
          recentEmails: emails.slice(0, 10),
        })
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch email metrics:', error)
      setLoading(false)
    }
  }

  if (loading) return <div>Loading...</div>
  if (!metrics) return <div>No data</div>

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Email Analytics</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Emails Sent (30d)</p>
          <p className="text-3xl font-bold">{metrics.totalSent}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Failed</p>
          <p className="text-3xl font-bold text-red-600">{metrics.totalFailed}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Success Rate</p>
          <p className="text-3xl font-bold text-green-600">
            {metrics.totalSent + metrics.totalFailed > 0
              ? Math.round((metrics.totalSent / (metrics.totalSent + metrics.totalFailed)) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Emails by Type */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Emails by Type</h2>
        <div className="space-y-2">
          {metrics.byType.map((item) => (
            <div key={item.type} className="flex justify-between items-center">
              <span className="capitalize">{item.type.replace(/_/g, ' ')}</span>
              <span className="font-bold">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Active Newsletter Subscribers</p>
          <p className="text-3xl font-bold">Coming from DB</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-gray-600">Pending Back-in-Stock Requests</p>
          <p className="text-3xl font-bold">Coming from DB</p>
        </div>
      </div>
    </div>
  )
}
```

---

## 6. Hook for Using Email Automation

### Create a custom hook for easier integration

```typescript
// src/hooks/useEmailAutomation.ts
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { emailAutomation } from '../lib/emailAutomation'

export function useEmailAutomation() {
  const { user } = useAuth()
  const { addToast } = useToast()

  const requestBackInStockNotification = async (
    productId: string,
    size: string
  ) => {
    if (!user) {
      addToast('Please sign in to request notifications', 'info')
      return false
    }

    try {
      const success = await emailAutomation.requestBackInStockNotification(
        productId,
        user.email,
        size
      )
      if (success) {
        addToast('📬 We\'ll notify you when this is back in stock!', 'success')
      }
      return success
    } catch (error) {
      addToast('Failed to set up notification', 'error')
      return false
    }
  }

  const subscribeToNewsletter = async (email: string, firstName?: string) => {
    try {
      const success = await emailAutomation.subscribeToNewsletter({
        email,
        firstName,
      })
      if (success) {
        addToast('Welcome to the newsletter! 🎉', 'success')
      }
      return success
    } catch (error) {
      addToast('Failed to subscribe', 'error')
      return false
    }
  }

  const trackCart = (items: CartLine[], cartValue: number) => {
    if (!user) return
    emailAutomation.trackCartActivity(user.email, items, cartValue)
  }

  return {
    requestBackInStockNotification,
    subscribeToNewsletter,
    trackCart,
  }
}
```

---

## 7. Testing Email Functions

### Manual testing via Supabase console

```sql
-- Test newsletter subscription
INSERT INTO newsletter_subscribers (email, first_name, is_active)
VALUES ('test@example.com', 'John', true);

-- Test back-in-stock request
INSERT INTO back_in_stock_requests (product_id, customer_email, size, is_active)
VALUES ('product-1', 'test@example.com', 'M', true);

-- Test cart abandonment tracking
INSERT INTO cart_abandonment_tracking (customer_email, cart_items, cart_value, last_activity_at)
VALUES (
  'test@example.com',
  '[{"id": "1", "name": "Shirt", "size": "M", "quantity": 1, "price": 500}]'::jsonb,
  500,
  NOW() - INTERVAL '25 hours'
);

-- View email logs
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;

-- View upcoming scheduled jobs
SELECT * FROM cron.job;

-- View failed jobs
SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC LIMIT 5;
```

---

## 8. Deployment Checklist

- [ ] Run migrations 006 and 007
- [ ] Enable pg_cron extension in Supabase
- [ ] Deploy Edge Functions (send-email, process-abandoned-carts, send-back-in-stock)
- [ ] Set environment variables in Supabase
- [ ] Update Newsletter.tsx component
- [ ] Update CartContext to track abandonment
- [ ] Add back-in-stock button to ProductDetail
- [ ] Add cart recovery to checkout flow
- [ ] Test email sending via send-email function
- [ ] Verify cron jobs in Supabase dashboard
- [ ] Monitor email_logs table for failures

---

## 9. Common Integration Patterns

### Pattern 1: Subscribe on Newsletter Form
```typescript
const [email, setEmail] = useState('')
const { subscribeToNewsletter } = useEmailAutomation()

const handleSubmit = async (e) => {
  e.preventDefault()
  await subscribeToNewsletter(email)
}
```

### Pattern 2: Track Cart Changes
```typescript
const { trackCart } = useEmailAutomation()

useEffect(() => {
  if (cart.length > 0) {
    const timer = setTimeout(() => {
      trackCart(cart, cartValue)
    }, 3000)
    return () => clearTimeout(timer)
  }
}, [cart])
```

### Pattern 3: Back-in-Stock on Product Page
```typescript
const { requestBackInStockNotification } = useEmailAutomation()

const handleNotifyMe = async () => {
  await requestBackInStockNotification(productId, selectedSize)
}
```

### Pattern 4: Mark Recovered on Order Success
```typescript
import { emailAutomation } from '../lib/emailAutomation'

// After order placement
await emailAutomation.markCartAsRecovered(order.email)
```

---

## Next Steps

1. **Update Newsletter Component** - Use code from section 1
2. **Update Cart Context** - Use code from section 2
3. **Add Back-in-Stock Button** - Use code from section 3
4. **Update Checkout** - Use code from section 4
5. **Deploy and Test** - Use testing guide in section 7
6. **Monitor Dashboard** - Build admin panel from section 5

All email automation is now ready to use! 🚀
