import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'

// Mock checkout validation component
const MockCheckoutForm = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const address = formData.get('address') as string
    const governorate = formData.get('governorate') as string
    const paymentMethod = formData.get('paymentMethod') as string
    
    // Checkout validation
    if (!email || !phone || !address || !governorate || !paymentMethod) {
      alert('All fields are required')
      return
    }
    
    if (!email.includes('@')) {
      alert('Invalid email format')
      return
    }
    
    if (phone.length < 11) {
      alert('Phone number must be at least 11 digits')
      return
    }
    
    if (address.length < 10) {
      alert('Address must be at least 10 characters')
      return
    }
    
    // Mock successful checkout
    alert('Order placed successfully')
  }

  return (
    <form onSubmit={handleSubmit} data-testid="checkout-form">
      <input
        name="email"
        type="email"
        placeholder="Email"
        data-testid="email-input"
      />
      <input
        name="phone"
        type="tel"
        placeholder="Phone"
        data-testid="phone-input"
      />
      <textarea
        name="address"
        placeholder="Address"
        data-testid="address-input"
      />
      <select name="governorate" data-testid="governorate-select">
        <option value="">Select Governorate</option>
        <option value="cairo">Cairo</option>
        <option value="giza">Giza</option>
        <option value="alexandria">Alexandria</option>
      </select>
      <div data-testid="payment-methods">
        <label>
          <input
            type="radio"
            name="paymentMethod"
            value="cod"
            data-testid="cod-radio"
          />
          Cash on Delivery
        </label>
        <label>
          <input
            type="radio"
            name="paymentMethod"
            value="card"
            data-testid="card-radio"
          />
          Credit Card
        </label>
      </div>
      <button type="submit" data-testid="place-order-button">
        Place Order
      </button>
    </form>
  )
}

const MockOrderSummary = ({ total = 299.99, shipping = 50, items = 1 }) => {
  const subtotal = total - shipping
  
  return (
    <div data-testid="order-summary">
      <div data-testid="items-count">{items} items</div>
      <div data-testid="subtotal">Subtotal: {subtotal} EGP</div>
      <div data-testid="shipping">Shipping: {shipping} EGP</div>
      <div data-testid="total">Total: {total} EGP</div>
    </div>
  )
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Checkout Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  describe('Form Validation', () => {
    it('renders checkout form correctly', () => {
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      expect(screen.getByTestId('checkout-form')).toBeInTheDocument()
      expect(screen.getByTestId('email-input')).toBeInTheDocument()
      expect(screen.getByTestId('phone-input')).toBeInTheDocument()
      expect(screen.getByTestId('address-input')).toBeInTheDocument()
      expect(screen.getByTestId('governorate-select')).toBeInTheDocument()
      expect(screen.getByTestId('payment-methods')).toBeInTheDocument()
      expect(screen.getByTestId('place-order-button')).toBeInTheDocument()
    })

    it('shows validation error for empty required fields', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('All fields are required')
      })
    })

    it('validates email format', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'invalid-email')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Invalid email format')
      })
    })

    it('validates phone number length', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '123')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Phone number must be at least 11 digits')
      })
    })

    it('validates address length', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), 'short')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Address must be at least 10 characters')
      })
    })

    it('processes valid checkout form', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Order placed successfully')
      })
    })

    it('handles credit card payment method', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'alexandria')
      await user.click(screen.getByTestId('card-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Order placed successfully')
      })
    })
  })

  describe('Order Summary', () => {
    it('displays order summary correctly', () => {
      render(
        <TestWrapper>
          <MockOrderSummary total={399.99} shipping={50} items={2} />
        </TestWrapper>
      )

      expect(screen.getByTestId('items-count')).toHaveTextContent('2 items')
      expect(screen.getByTestId('subtotal')).toHaveTextContent('Subtotal: 349.99 EGP')
      expect(screen.getByTestId('shipping')).toHaveTextContent('Shipping: 50 EGP')
      expect(screen.getByTestId('total')).toHaveTextContent('Total: 399.99 EGP')
    })

    it('handles free shipping correctly', () => {
      render(
        <TestWrapper>
          <MockOrderSummary total={1000} shipping={0} items={5} />
        </TestWrapper>
      )

      expect(screen.getByTestId('items-count')).toHaveTextContent('5 items')
      expect(screen.getByTestId('subtotal')).toHaveTextContent('Subtotal: 1000 EGP')
      expect(screen.getByTestId('shipping')).toHaveTextContent('Shipping: 0 EGP')
      expect(screen.getByTestId('total')).toHaveTextContent('Total: 1000 EGP')
    })

    it('handles single item order', () => {
      render(
        <TestWrapper>
          <MockOrderSummary total={149.99} shipping={50} items={1} />
        </TestWrapper>
      )

      expect(screen.getByTestId('items-count')).toHaveTextContent('1 items')
      expect(screen.getByTestId('subtotal')).toHaveTextContent('Subtotal: 99.99 EGP')
      expect(screen.getByTestId('shipping')).toHaveTextContent('Shipping: 50 EGP')
      expect(screen.getByTestId('total')).toHaveTextContent('Total: 149.99 EGP')
    })
  })

  describe('Governorate Selection', () => {
    it('allows selecting different governorates', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      const governorateSelect = screen.getByTestId('governorate-select')
      
      await user.selectOptions(governorateSelect, 'giza')
      expect(governorateSelect).toHaveValue('giza')
      
      await user.selectOptions(governorateSelect, 'alexandria')
      expect(governorateSelect).toHaveValue('alexandria')
    })

    it('validates governorate selection', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      // Skip governorate selection
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('All fields are required')
      })
    })
  })

  describe('Payment Method Selection', () => {
    it('allows selecting payment methods', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      const codRadio = screen.getByTestId('cod-radio')
      const cardRadio = screen.getByTestId('card-radio')
      
      await user.click(codRadio)
      expect(codRadio).toBeChecked()
      expect(cardRadio).not.toBeChecked()
      
      await user.click(cardRadio)
      expect(cardRadio).toBeChecked()
      expect(codRadio).not.toBeChecked()
    })

    it('validates payment method selection', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      // Skip payment method selection
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('All fields are required')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles very long address', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      const longAddress = 'A'.repeat(500)

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), longAddress)
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Order placed successfully')
      })
    })

    it('handles special characters in phone number', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.com')
      await user.type(screen.getByTestId('phone-input'), '+201234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Order placed successfully')
      })
    })

    it('handles international email domains', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockCheckoutForm />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('email-input'), 'test@example.co.uk')
      await user.type(screen.getByTestId('phone-input'), '01234567890')
      await user.type(screen.getByTestId('address-input'), '123 Main Street, Cairo, Egypt')
      await user.selectOptions(screen.getByTestId('governorate-select'), 'cairo')
      await user.click(screen.getByTestId('cod-radio'))
      await user.click(screen.getByTestId('place-order-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Order placed successfully')
      })
    })
  })
})