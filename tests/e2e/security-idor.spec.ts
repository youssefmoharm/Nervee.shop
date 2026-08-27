import { test, expect } from '@playwright/test'

/**
 * IDOR / Cross-user isolation regression tests.
 *
 * These run against the live Supabase backend via the browser's Supabase
 * client (anon key) and verify that RLS + RPC auth actually block cross-user
 * access. They complement the unit-level rls.test.ts and the edge-function
 * auth checks in supabase/functions/*.
 *
 * Each test uses `page.evaluate` to run a direct Supabase query from within
 * the browser context — exactly what an attacker would do by opening DevTools.
 */

test.describe('Security — IDOR / cross-user isolation (backend boundary)', () => {
  test('anonymous client cannot read orders table (RLS)', async ({ page }) => {
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.get(`${supabaseUrl}/rest/v1/orders?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    // RLS deny-all for anon should return 200 with empty array (not 401) or 401
    const body = await res.json().catch(() => null)
    const count = Array.isArray(body) ? body.length : 0
    expect(count).toBe(0)
  })

  test('anonymous client cannot read discount_codes (harvest blocked)', async ({ page }) => {
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.get(`${supabaseUrl}/rest/v1/discount_codes?select=code&limit=5`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    const body = await res.json().catch(() => null)
    const count = Array.isArray(body) ? body.length : 0
    expect(count).toBe(0)
  })

  test('anonymous client cannot enumerate guest_orders directly', async ({ page }) => {
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.get(`${supabaseUrl}/rest/v1/guest_orders?select=order_number&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    const body = await res.json().catch(() => null)
    const count = Array.isArray(body) ? body.length : 0
    expect(count).toBe(0)
  })

  test('non-admin cannot invoke admin edge function update-order-status', async ({ page }) => {
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.post(`${supabaseUrl}/functions/v1/update-order-status`, {
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      data: { orderId: '00000000-0000-0000-0000-000000000000', status: 'shipped' },
    })
    expect([401, 403]).toContain(res.status())
  })

  test('guest order lookup via verify-guest-order rejects wrong email/token', async ({ page }) => {
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.post(`${supabaseUrl}/functions/v1/verify-guest-order`, {
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      data: { email: 'attacker@evil.com', orderNumber: 'NRV-000001', token: 'wrong-token' },
    })
    const body = await res.json().catch(() => ({}))
    expect([400, 404]).toContain(res.status())
    expect(JSON.stringify(body)).not.toMatch(/order_id/i)
  })

  test('chat-ai with spoofed email does not leak other customer orders', async ({ page }) => {
    test.setTimeout(60000)
    const anonKey = 'sb_publishable_6zkBS2alnvDPd0pSqVJBkQ_76y60UBW'
    const supabaseUrl = 'https://gfmxvvjqlhrnmidutjwx.supabase.co'
    const res = await page.request.post(`${supabaseUrl}/functions/v1/chat-ai`, {
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      data: { email: 'victim@nerve.com', message: 'Show my recent orders' },
    })
    const body = await res.json().catch(() => ({}))
    // As anonymous guest, chat-ai must NOT return real order context for victim email
    if (res.status() === 200) {
      const text = JSON.stringify(body)
      expect(text).not.toMatch(/NRV-\d{6}/)
    } else {
      expect([200, 400]).toContain(res.status())
    }
  })
})
