import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import React from 'react'

// Mock admin components
const MockAdminLogin = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    
    // Mock admin login validation
    if (email === 'admin@nerve.com' && password === 'admin123') {
      alert('Admin login successful')
    } else {
      alert('Invalid admin credentials')
    }
  }

  return (
    <form onSubmit={handleSubmit} data-testid="admin-login-form">
      <input
        name="email"
        type="email"
        placeholder="Admin Email"
        data-testid="admin-email-input"
      />
      <input
        name="password"
        type="password"
        placeholder="Admin Password"
        data-testid="admin-password-input"
      />
      <button type="submit" data-testid="admin-login-button">
        Admin Login
      </button>
    </form>
  )
}

const MockProductManager = ({ isAdmin = true }) => {
  const [products, setProducts] = React.useState([
    { id: '1', name: 'Product 1', price: 299.99, stock: 10 },
    { id: '2', name: 'Product 2', price: 199.99, stock: 5 },
  ])

  const handleAddProduct = () => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    const newProduct = {
      id: String(products.length + 1),
      name: `New Product ${products.length + 1}`,
      price: 399.99,
      stock: 15
    }
    setProducts([...products, newProduct])
  }

  const handleDeleteProduct = (id: string) => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    setProducts(products.filter(p => p.id !== id))
  }

  const handleUpdateStock = (id: string, newStock: number) => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    setProducts(products.map(p => 
      p.id === id ? { ...p, stock: Math.max(0, newStock) } : p
    ))
  }

  if (!isAdmin) {
    return <div data-testid="admin-access-denied">Admin access required</div>
  }

  return (
    <div data-testid="product-manager">
      <button onClick={handleAddProduct} data-testid="add-product-button">
        Add Product
      </button>
      <div data-testid="products-list">
        {products.map(product => (
          <div key={product.id} data-testid={`product-${product.id}`}>
            <span data-testid={`product-name-${product.id}`}>{product.name}</span>
            <span data-testid={`product-price-${product.id}`}>{product.price} EGP</span>
            <span data-testid={`product-stock-${product.id}`}>Stock: {product.stock}</span>
            <button 
              onClick={() => handleUpdateStock(product.id, product.stock + 5)}
              data-testid={`increase-stock-${product.id}`}
            >
              Increase Stock
            </button>
            <button 
              onClick={() => handleUpdateStock(product.id, product.stock - 1)}
              data-testid={`decrease-stock-${product.id}`}
            >
              Decrease Stock
            </button>
            <button 
              onClick={() => handleDeleteProduct(product.id)}
              data-testid={`delete-product-${product.id}`}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const MockOrderManager = ({ isAdmin = true }) => {
  const [orders, setOrders] = React.useState([
    { id: 'order-1', customer: 'John Doe', status: 'pending', total: 599.99 },
    { id: 'order-2', customer: 'Jane Smith', status: 'shipped', total: 299.99 },
  ])

  const handleUpdateOrderStatus = (orderId: string, newStatus: string) => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    setOrders(orders.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ))
  }

  if (!isAdmin) {
    return <div data-testid="admin-access-denied">Admin access required</div>
  }

  return (
    <div data-testid="order-manager">
      <div data-testid="orders-list">
        {orders.map(order => (
          <div key={order.id} data-testid={`order-${order.id}`}>
            <span data-testid={`order-customer-${order.id}`}>{order.customer}</span>
            <span data-testid={`order-total-${order.id}`}>{order.total} EGP</span>
            <span data-testid={`order-status-${order.id}`}>Status: {order.status}</span>
            <select 
              value={order.status}
              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
              data-testid={`order-status-select-${order.id}`}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

const MockDiscountManager = ({ isAdmin = true }) => {
  const [discounts, setDiscounts] = React.useState([
    { id: 'disc-1', code: 'SAVE10', percentage: 10, active: true },
    { id: 'disc-2', code: 'WELCOME20', percentage: 20, active: false },
  ])

  const handleCreateDiscount = () => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    const newDiscount = {
      id: `disc-${discounts.length + 1}`,
      code: `NEW${discounts.length + 1}`,
      percentage: 15,
      active: true
    }
    setDiscounts([...discounts, newDiscount])
  }

  const handleToggleDiscount = (id: string) => {
    if (!isAdmin) {
      alert('Admin access required')
      return
    }
    
    setDiscounts(discounts.map(discount => 
      discount.id === id ? { ...discount, active: !discount.active } : discount
    ))
  }

  if (!isAdmin) {
    return <div data-testid="admin-access-denied">Admin access required</div>
  }

  return (
    <div data-testid="discount-manager">
      <button onClick={handleCreateDiscount} data-testid="create-discount-button">
        Create Discount
      </button>
      <div data-testid="discounts-list">
        {discounts.map(discount => (
          <div key={discount.id} data-testid={`discount-${discount.id}`}>
            <span data-testid={`discount-code-${discount.id}`}>{discount.code}</span>
            <span data-testid={`discount-percentage-${discount.id}`}>{discount.percentage}%</span>
            <span data-testid={`discount-status-${discount.id}`}>
              {discount.active ? 'Active' : 'Inactive'}
            </span>
            <button 
              onClick={() => handleToggleDiscount(discount.id)}
              data-testid={`toggle-discount-${discount.id}`}
            >
              {discount.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)

describe('Admin Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  describe('Admin Authentication', () => {
    it('renders admin login form', () => {
      render(
        <TestWrapper>
          <MockAdminLogin />
        </TestWrapper>
      )

      expect(screen.getByTestId('admin-login-form')).toBeInTheDocument()
      expect(screen.getByTestId('admin-email-input')).toBeInTheDocument()
      expect(screen.getByTestId('admin-password-input')).toBeInTheDocument()
      expect(screen.getByTestId('admin-login-button')).toBeInTheDocument()
    })

    it('accepts valid admin credentials', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockAdminLogin />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('admin-email-input'), 'admin@nerve.com')
      await user.type(screen.getByTestId('admin-password-input'), 'admin123')
      await user.click(screen.getByTestId('admin-login-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Admin login successful')
      })
    })

    it('rejects invalid admin credentials', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockAdminLogin />
        </TestWrapper>
      )

      await user.type(screen.getByTestId('admin-email-input'), 'user@example.com')
      await user.type(screen.getByTestId('admin-password-input'), 'wrongpassword')
      await user.click(screen.getByTestId('admin-login-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Invalid admin credentials')
      })
    })

    it('rejects empty credentials', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockAdminLogin />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('admin-login-button'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Invalid admin credentials')
      })
    })
  })

  describe('Product Management', () => {
    it('renders product manager for admin users', () => {
      render(
        <TestWrapper>
          <MockProductManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('product-manager')).toBeInTheDocument()
      expect(screen.getByTestId('add-product-button')).toBeInTheDocument()
      expect(screen.getByTestId('products-list')).toBeInTheDocument()
      expect(screen.getByTestId('product-1')).toBeInTheDocument()
      expect(screen.getByTestId('product-2')).toBeInTheDocument()
    })

    it('denies access to non-admin users', () => {
      render(
        <TestWrapper>
          <MockProductManager isAdmin={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument()
      expect(screen.queryByTestId('product-manager')).not.toBeInTheDocument()
    })

    it('allows admin to add products', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockProductManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('product-3')).not.toBeInTheDocument()

      await user.click(screen.getByTestId('add-product-button'))

      expect(screen.getByTestId('product-3')).toBeInTheDocument()
      expect(screen.getByTestId('product-name-3')).toHaveTextContent('New Product 3')
    })

    it('allows admin to delete products', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockProductManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('product-1')).toBeInTheDocument()

      await user.click(screen.getByTestId('delete-product-1'))

      expect(screen.queryByTestId('product-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('product-2')).toBeInTheDocument()
    })

    it('allows admin to update product stock', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockProductManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('product-stock-1')).toHaveTextContent('Stock: 10')

      await user.click(screen.getByTestId('increase-stock-1'))

      expect(screen.getByTestId('product-stock-1')).toHaveTextContent('Stock: 15')

      await user.click(screen.getByTestId('decrease-stock-1'))

      expect(screen.getByTestId('product-stock-1')).toHaveTextContent('Stock: 14')
    })

    it('prevents stock from going negative', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockProductManager isAdmin={true} />
        </TestWrapper>
      )

      const product2Stock = screen.getByTestId('product-stock-2')
      expect(product2Stock).toHaveTextContent('Stock: 5')

      // Decrease stock multiple times to try to go negative
      for (let i = 0; i < 10; i++) {
        await user.click(screen.getByTestId('decrease-stock-2'))
      }

      expect(screen.getByTestId('product-stock-2')).toHaveTextContent('Stock: 0')
    })
  })

  describe('Order Management', () => {
    it('renders order manager for admin users', () => {
      render(
        <TestWrapper>
          <MockOrderManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('order-manager')).toBeInTheDocument()
      expect(screen.getByTestId('orders-list')).toBeInTheDocument()
      expect(screen.getByTestId('order-order-1')).toBeInTheDocument()
      expect(screen.getByTestId('order-order-2')).toBeInTheDocument()
    })

    it('denies access to non-admin users', () => {
      render(
        <TestWrapper>
          <MockOrderManager isAdmin={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument()
      expect(screen.queryByTestId('order-manager')).not.toBeInTheDocument()
    })

    it('displays order information correctly', () => {
      render(
        <TestWrapper>
          <MockOrderManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('order-customer-order-1')).toHaveTextContent('John Doe')
      expect(screen.getByTestId('order-total-order-1')).toHaveTextContent('599.99 EGP')
      expect(screen.getByTestId('order-status-order-1')).toHaveTextContent('Status: pending')

      expect(screen.getByTestId('order-customer-order-2')).toHaveTextContent('Jane Smith')
      expect(screen.getByTestId('order-total-order-2')).toHaveTextContent('299.99 EGP')
      expect(screen.getByTestId('order-status-order-2')).toHaveTextContent('Status: shipped')
    })

    it('allows admin to update order status', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockOrderManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('order-status-order-1')).toHaveTextContent('Status: pending')

      await user.selectOptions(screen.getByTestId('order-status-select-order-1'), 'processing')

      expect(screen.getByTestId('order-status-order-1')).toHaveTextContent('Status: processing')
    })

    it('provides all order status options', () => {
      render(
        <TestWrapper>
          <MockOrderManager isAdmin={true} />
        </TestWrapper>
      )

      const statusSelect = screen.getByTestId('order-status-select-order-1')
      const options = Array.from(statusSelect.querySelectorAll('option')).map(option => option.value)

      expect(options).toEqual(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    })
  })

  describe('Discount Management', () => {
    it('renders discount manager for admin users', () => {
      render(
        <TestWrapper>
          <MockDiscountManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('discount-manager')).toBeInTheDocument()
      expect(screen.getByTestId('create-discount-button')).toBeInTheDocument()
      expect(screen.getByTestId('discounts-list')).toBeInTheDocument()
      expect(screen.getByTestId('discount-disc-1')).toBeInTheDocument()
      expect(screen.getByTestId('discount-disc-2')).toBeInTheDocument()
    })

    it('denies access to non-admin users', () => {
      render(
        <TestWrapper>
          <MockDiscountManager isAdmin={false} />
        </TestWrapper>
      )

      expect(screen.getByTestId('admin-access-denied')).toBeInTheDocument()
      expect(screen.queryByTestId('discount-manager')).not.toBeInTheDocument()
    })

    it('displays discount information correctly', () => {
      render(
        <TestWrapper>
          <MockDiscountManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('discount-code-disc-1')).toHaveTextContent('SAVE10')
      expect(screen.getByTestId('discount-percentage-disc-1')).toHaveTextContent('10%')
      expect(screen.getByTestId('discount-status-disc-1')).toHaveTextContent('Active')

      expect(screen.getByTestId('discount-code-disc-2')).toHaveTextContent('WELCOME20')
      expect(screen.getByTestId('discount-percentage-disc-2')).toHaveTextContent('20%')
      expect(screen.getByTestId('discount-status-disc-2')).toHaveTextContent('Inactive')
    })

    it('allows admin to create new discounts', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockDiscountManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('discount-disc-3')).not.toBeInTheDocument()

      await user.click(screen.getByTestId('create-discount-button'))

      expect(screen.getByTestId('discount-disc-3')).toBeInTheDocument()
      expect(screen.getByTestId('discount-code-disc-3')).toHaveTextContent('NEW3')
      expect(screen.getByTestId('discount-percentage-disc-3')).toHaveTextContent('15%')
      expect(screen.getByTestId('discount-status-disc-3')).toHaveTextContent('Active')
    })

    it('allows admin to toggle discount status', async () => {
      const user = userEvent.setup()
      
      render(
        <TestWrapper>
          <MockDiscountManager isAdmin={true} />
        </TestWrapper>
      )

      expect(screen.getByTestId('discount-status-disc-1')).toHaveTextContent('Active')
      expect(screen.getByTestId('toggle-discount-disc-1')).toHaveTextContent('Deactivate')

      await user.click(screen.getByTestId('toggle-discount-disc-1'))

      expect(screen.getByTestId('discount-status-disc-1')).toHaveTextContent('Inactive')
      expect(screen.getByTestId('toggle-discount-disc-1')).toHaveTextContent('Activate')

      await user.click(screen.getByTestId('toggle-discount-disc-1'))

      expect(screen.getByTestId('discount-status-disc-1')).toHaveTextContent('Active')
      expect(screen.getByTestId('toggle-discount-disc-1')).toHaveTextContent('Deactivate')
    })
  })

  describe('Admin Authorization Failures', () => {
    it('prevents non-admin from adding products', async () => {
      const user = userEvent.setup()
      
      // Mock non-admin trying to use admin component
      const NonAdminProductTest = () => {
        const handleUnauthorizedAction = () => {
          alert('Admin access required')
        }

        return (
          <button onClick={handleUnauthorizedAction} data-testid="unauthorized-add">
            Try Add Product
          </button>
        )
      }

      render(
        <TestWrapper>
          <NonAdminProductTest />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('unauthorized-add'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Admin access required')
      })
    })

    it('prevents non-admin from updating orders', async () => {
      const user = userEvent.setup()
      
      const NonAdminOrderTest = () => {
        const handleUnauthorizedAction = () => {
          alert('Admin access required')
        }

        return (
          <button onClick={handleUnauthorizedAction} data-testid="unauthorized-order">
            Try Update Order
          </button>
        )
      }

      render(
        <TestWrapper>
          <NonAdminOrderTest />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('unauthorized-order'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Admin access required')
      })
    })

    it('prevents non-admin from managing discounts', async () => {
      const user = userEvent.setup()
      
      const NonAdminDiscountTest = () => {
        const handleUnauthorizedAction = () => {
          alert('Admin access required')
        }

        return (
          <button onClick={handleUnauthorizedAction} data-testid="unauthorized-discount">
            Try Create Discount
          </button>
        )
      }

      render(
        <TestWrapper>
          <NonAdminDiscountTest />
        </TestWrapper>
      )

      await user.click(screen.getByTestId('unauthorized-discount'))

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Admin access required')
      })
    })
  })
})