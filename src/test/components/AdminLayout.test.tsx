import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AdminLayout from '../../pages/Admin/AdminLayout'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}))

describe('AdminLayout', () => {
  it('renders the secondary admin navigation links', () => {
    render(
      <MemoryRouter>
        <AdminLayout>
          <div>Content</div>
        </AdminLayout>
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /contacts/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /newsletter/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /payments/i })).toBeInTheDocument()
  })
})
