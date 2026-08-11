import { describe, it, expect, beforeEach } from 'vitest'
import { server } from '../setup'
import { http, HttpResponse } from 'msw'

// Mock webhook payload structure
interface WebhookPayload {
  obj: {
    id: number
    success: boolean
    pending: boolean
    amount_cents: number
    currency: string
    created_at: string
    order: {
      id: number
      merchant_order_id: string
    }
    integration_id: number
    error_occured: boolean
    has_parent_transaction: boolean
    is_3d_secure: boolean
    is_auth: boolean
    is_capture: boolean
    is_refunded: boolean
    is_standalone_payment: boolean
    is_voided: boolean
    owner: number
    source_data: {
      pan: string
      sub_type: string
      type: string
    }
  }
}

// Mock HMAC calculation
function calculateMockHMAC(payload: WebhookPayload): string {
  // This would be the actual HMAC calculation in real implementation
  // For testing, we'll use a deterministic mock
  const data = [
    payload.obj.amount_cents,
    payload.obj.created_at,
    payload.obj.currency,
    payload.obj.error_occured,
    payload.obj.has_parent_transaction,
    payload.obj.id,
    payload.obj.integration_id,
    payload.obj.is_3d_secure,
    payload.obj.is_auth,
    payload.obj.is_capture,
    payload.obj.is_refunded,
    payload.obj.is_standalone_payment,
    payload.obj.is_voided,
    payload.obj.order.id,
    payload.obj.owner,
    payload.obj.pending,
    payload.obj.source_data.pan,
    payload.obj.source_data.sub_type,
    payload.obj.source_data.type,
    payload.obj.success,
  ].join('')
  
  return `mock-hmac-${data.length}` // Deterministic mock HMAC
}

// Mock webhook handler response
function mockWebhookHandler(payload: WebhookPayload, hmac: string, expectedHmac?: string) {
  const order = {
    id: 'order-123',
    order_number: payload.obj.order.merchant_order_id,
    total: payload.obj.amount_cents / 100, // Convert cents to EGP
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User'
  }

  // Validate HMAC
  if (hmac !== (expectedHmac || calculateMockHMAC(payload))) {
    return { error: 'Invalid signature', status: 401 }
  }

  // Validate timestamp (prevent replay attacks)
  const transactionTime = new Date(payload.obj.created_at).getTime()
  const currentTime = Date.now()
  const maxAge = 5 * 60 * 1000 // 5 minutes
  
  if (currentTime - transactionTime > maxAge) {
    return { error: 'Transaction expired', status: 400 }
  }

  // Validate amount
  if (payload.obj.success && payload.obj.amount_cents !== order.total * 100) {
    return { error: 'Amount mismatch', status: 400 }
  }

  // Validate currency
  if (payload.obj.success && payload.obj.currency !== 'EGP') {
    return { error: 'Currency mismatch', status: 400 }
  }

  // Process payment result
  const paymentStatus = payload.obj.success ? 'paid' : payload.obj.pending ? 'pending' : 'failed'
  
  return {
    applied: true,
    paymentStatus,
    order: {
      ...order,
      payment_status: paymentStatus,
      status: payload.obj.success ? 'processing' : 'placed'
    }
  }
}

describe('Payment Webhook Tests', () => {
  const baseTime = new Date('2024-01-01T10:00:00Z').getTime()
  
  const createMockPayload = (overrides: Partial<WebhookPayload['obj']> = {}): WebhookPayload => ({
    obj: {
      id: 12345,
      success: true,
      pending: false,
      amount_cents: 100000, // EGP 1000.00
      currency: 'EGP',
      created_at: new Date(baseTime).toISOString(),
      order: {
        id: 67890,
        merchant_order_id: 'NRV-123456'
      },
      integration_id: 123,
      error_occured: false,
      has_parent_transaction: false,
      is_3d_secure: false,
      is_auth: true,
      is_capture: true,
      is_refunded: false,
      is_standalone_payment: true,
      is_voided: false,
      owner: 456,
      source_data: {
        pan: '****1234',
        sub_type: 'VISA',
        type: 'card'
      },
      ...overrides
    }
  })

  describe('Valid Payment Processing', () => {
    it('processes valid successful payment', () => {
      const payload = createMockPayload({ success: true, pending: false })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
      expect(result.order?.payment_status).toBe('paid')
      expect(result.order?.status).toBe('processing')
    })

    it('processes valid pending payment', () => {
      const payload = createMockPayload({ success: false, pending: true })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('pending')
      expect(result.order?.payment_status).toBe('pending')
      expect(result.order?.status).toBe('placed')
    })

    it('processes valid failed payment', () => {
      const payload = createMockPayload({ success: false, pending: false })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('failed')
      expect(result.order?.payment_status).toBe('failed')
      expect(result.order?.status).toBe('placed')
    })
  })

  describe('HMAC Security Tests', () => {
    it('rejects webhook with invalid HMAC', () => {
      const payload = createMockPayload()
      const invalidHmac = 'invalid-hmac-signature'
      
      const result = mockWebhookHandler(payload, invalidHmac)
      
      expect(result.error).toBe('Invalid signature')
      expect(result.status).toBe(401)
    })

    it('accepts webhook with valid HMAC', () => {
      const payload = createMockPayload()
      const validHmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, validHmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
    })

    it('rejects webhook with tampered amount but valid HMAC structure', () => {
      const payload = createMockPayload({ amount_cents: 50000 }) // Different amount
      const originalPayload = createMockPayload({ amount_cents: 100000 })
      const hmacForOriginal = calculateMockHMAC(originalPayload)
      
      const result = mockWebhookHandler(payload, hmacForOriginal)
      
      expect(result.error).toBe('Invalid signature')
      expect(result.status).toBe(401)
    })
  })

  describe('Amount Validation Tests', () => {
    it('rejects payment with wrong amount', () => {
      const payload = createMockPayload({ 
        success: true, 
        amount_cents: 50000 // Wrong amount - should be 100000
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.error).toBe('Amount mismatch')
      expect(result.status).toBe(400)
    })

    it('accepts payment with correct amount', () => {
      const payload = createMockPayload({ 
        success: true, 
        amount_cents: 100000 // Correct amount
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
    })

    it('skips amount validation for failed payments', () => {
      const payload = createMockPayload({ 
        success: false, 
        pending: false,
        amount_cents: 50000 // Wrong amount, but payment failed so it doesn't matter
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('failed')
    })
  })

  describe('Currency Validation Tests', () => {
    it('rejects payment with wrong currency', () => {
      const payload = createMockPayload({ 
        success: true, 
        currency: 'USD' // Wrong currency
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.error).toBe('Currency mismatch')
      expect(result.status).toBe(400)
    })

    it('accepts payment with correct currency', () => {
      const payload = createMockPayload({ 
        success: true, 
        currency: 'EGP' // Correct currency
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
    })
  })

  describe('Order Reference Validation Tests', () => {
    it('processes webhook with correct order reference', () => {
      const payload = createMockPayload({ 
        order: { id: 67890, merchant_order_id: 'NRV-123456' }
      })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
    })
  })

  describe('Timestamp Validation Tests', () => {
    it('rejects old webhook (replay attack prevention)', () => {
      const oldTime = new Date(baseTime - 10 * 60 * 1000).toISOString() // 10 minutes ago
      const payload = createMockPayload({ created_at: oldTime })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      
      expect(result.error).toBe('Transaction expired')
      expect(result.status).toBe(400)
    })

    it('accepts recent webhook', () => {
      const recentTime = new Date(baseTime - 2 * 60 * 1000).toISOString() // 2 minutes ago
      const payload = createMockPayload({ created_at: recentTime })
      const hmac = calculateMockHMAC(payload)
      
      // Mock current time to be baseTime
      const originalNow = Date.now
      Date.now = () => baseTime
      
      try {
        const result = mockWebhookHandler(payload, hmac)
        expect(result.applied).toBe(true)
        expect(result.paymentStatus).toBe('paid')
      } finally {
        Date.now = originalNow
      }
    })

    it('accepts webhook at exact age limit', () => {
      const limitTime = new Date(baseTime - 5 * 60 * 1000).toISOString() // Exactly 5 minutes ago
      const payload = createMockPayload({ created_at: limitTime })
      const hmac = calculateMockHMAC(payload)
      
      const originalNow = Date.now
      Date.now = () => baseTime
      
      try {
        const result = mockWebhookHandler(payload, hmac)
        expect(result.applied).toBe(true)
      } finally {
        Date.now = originalNow
      }
    })
  })

  describe('Duplicate Webhook Prevention', () => {
    const processedTransactions = new Set<string>()
    
    const mockIdempotentHandler = (payload: WebhookPayload, hmac: string) => {
      const transactionId = payload.obj.id.toString()
      
      // Check if already processed
      if (processedTransactions.has(transactionId)) {
        return { applied: false, paymentStatus: 'already_processed' }
      }
      
      const result = mockWebhookHandler(payload, hmac)
      
      // Mark as processed if successful
      if (result.applied) {
        processedTransactions.add(transactionId)
      }
      
      return result
    }

    it('processes webhook first time', () => {
      const payload = createMockPayload({ id: 999001 })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockIdempotentHandler(payload, hmac)
      
      expect(result.applied).toBe(true)
      expect(result.paymentStatus).toBe('paid')
    })

    it('ignores duplicate webhook', () => {
      const payload = createMockPayload({ id: 999002 })
      const hmac = calculateMockHMAC(payload)
      
      // Process first time
      const firstResult = mockIdempotentHandler(payload, hmac)
      expect(firstResult.applied).toBe(true)
      
      // Process duplicate
      const duplicateResult = mockIdempotentHandler(payload, hmac)
      expect(duplicateResult.applied).toBe(false)
      expect(duplicateResult.paymentStatus).toBe('already_processed')
    })

    it('handles multiple different transactions', () => {
      const payload1 = createMockPayload({ id: 999003 })
      const payload2 = createMockPayload({ id: 999004 })
      const hmac1 = calculateMockHMAC(payload1)
      const hmac2 = calculateMockHMAC(payload2)
      
      // Process both transactions
      const result1 = mockIdempotentHandler(payload1, hmac1)
      const result2 = mockIdempotentHandler(payload2, hmac2)
      
      expect(result1.applied).toBe(true)
      expect(result2.applied).toBe(true)
      
      // Process duplicates
      const duplicate1 = mockIdempotentHandler(payload1, hmac1)
      const duplicate2 = mockIdempotentHandler(payload2, hmac2)
      
      expect(duplicate1.applied).toBe(false)
      expect(duplicate2.applied).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('handles missing order reference safely', () => {
      const payload = createMockPayload()
      delete (payload.obj as any).order
      const hmac = calculateMockHMAC(payload)
      
      // In real implementation, this would be handled gracefully
      expect(() => mockWebhookHandler(payload, hmac)).not.toThrow()
    })

    it('handles zero amount transactions', () => {
      const payload = createMockPayload({ amount_cents: 0 })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      expect(result.error).toBe('Amount mismatch') // 0 doesn't match expected order total
    })

    it('handles very large amounts', () => {
      const payload = createMockPayload({ amount_cents: 999999999 })
      const hmac = calculateMockHMAC(payload)
      
      const result = mockWebhookHandler(payload, hmac)
      expect(result.error).toBe('Amount mismatch') // Doesn't match expected order total
    })

    it('handles malformed timestamps gracefully', () => {
      const payload = createMockPayload({ created_at: 'invalid-date' })
      const hmac = calculateMockHMAC(payload)
      
      // Should handle invalid dates gracefully (in real implementation)
      expect(() => mockWebhookHandler(payload, hmac)).not.toThrow()
    })
  })
})