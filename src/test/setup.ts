import '@testing-library/jest-dom'
import { beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Mock Supabase for testing
const mockSupabaseHandlers = [
  // Mock auth
  http.post('*/auth/v1/token*', () => {
    return HttpResponse.json({
      access_token: 'mock-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
      },
    })
  }),

  // Mock database queries
  http.get('*/rest/v1/*', ({ request }) => {
    const url = new URL(request.url)
    const table = url.pathname.split('/').pop()
    
    // Return appropriate mock data based on table
    switch (table) {
      case 'products':
        return HttpResponse.json([])
      case 'orders':
        return HttpResponse.json([])
      case 'customers':
        return HttpResponse.json([])
      default:
        return HttpResponse.json([])
    }
  }),
]

export const server = setupServer(...mockSupabaseHandlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test.supabase.co'
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key'