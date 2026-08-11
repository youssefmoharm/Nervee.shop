/**
 * Security Regression Tests
 * 
 * Run these tests to verify security fixes are working correctly.
 * These tests should fail if security vulnerabilities are re-introduced.
 */

describe('Security Regression Tests', () => {
  describe('HMAC Validation (paymob-webhook)', () => {
    it('rejects requests with invalid HMAC signature', async () => {
      const response = await fetch('http://localhost:54321/functions/v1/paymob-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obj: {
            id: 'test-transaction-123',
            success: true,
            amount_cents: 10000,
            order: { merchant_order_id: 'NRV-123456' },
            created_at: new Date().toISOString()
          }
        })
      });
      
      // Should return 401 Unauthorized for invalid HMAC
      expect(response.status).toBe(401);
    });

    it('rejects replay attacks (old timestamp)', async () => {
      const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 minutes ago
      
      const response = await fetch('http://localhost:54321/functions/v1/paymob-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obj: {
            id: 'test-transaction-old',
            success: true,
            amount_cents: 10000,
            order: { merchant_order_id: 'NRV-123456' },
            created_at: oldTimestamp
          }
        })
      });
      
      // Should return 400 for old transactions
      expect(response.status).toBe(400);
      expect(await response.text()).toContain('expired');
    });
  });

  describe('Rate Limiting', () => {
    it('enforces 10 orders per minute limit', async () => {
      // Simulate 11 rapid order requests
      const results = [];
      for (let i = 0; i < 11; i++) {
        const response = await fetch('http://localhost:54321/functions/v1/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            phone: '01000000000',
            address: '123 Test St',
            city: 'Cairo',
            governorate: 'Cairo',
            deliveryMethod: 'standard',
            paymentMethod: 'cod',
            items: [{ productId: 'p-001', color: 'Navy', size: 'M', quantity: 1 }]
          })
        });
        results.push(response.status);
      }
      
      // First 10 should succeed (200), 11th should fail (429)
      const successCount = results.filter(s => s === 200).length;
      const rateLimitedCount = results.filter(s => s === 429).length;
      
      expect(successCount).toBe(10);
      expect(rateLimitedCount).toBe(1);
    });
  });

  describe('RLS Policies', () => {
    it('prevents anonymous users from accessing orders', async () => {
      // Attempt to query orders without authentication
      const { data, error } = await supabase
        .from('orders')
        .select('*');
      
      // Should return no data (not an error, but empty result)
      expect(data).toBeNull() || expect(data).toEqual([]);
    });

    it('prevents users from accessing other users orders', async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', 'different-user-id');
      
      // Should return no data (RLS filters by auth.uid())
      expect(data).toBeNull() || expect(data).toEqual([]);
    });
  });

  describe('Input Validation', () => {
    it('rejects SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE orders; --";
      
      const response = await fetch('http://localhost:54321/functions/v1/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: maliciousInput,
          firstName: 'Test',
          lastName: 'User',
          // ... other required fields
        })
      });
      
      // Should return 400 Bad Request
      expect(response.status).toBe(400);
    });

    it('rejects XSS attempts in user input', async () => {
      const xssInput = "<script>alert('xss')</script>";
      
      const response = await fetch('http://localhost:54321/functions/v1/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          firstName: xssInput,
          // ... other required fields
        })
      });
      
      // Should return 400 Bad Request
      expect(response.status).toBe(400);
    });
  });
});
