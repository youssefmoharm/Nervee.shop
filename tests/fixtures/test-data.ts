// Test fixtures and data for E2E tests
export const testUsers = {
  customer: {
    email: 'customer@test.com',
    password: 'Test123!@#',
    firstName: 'John',
    lastName: 'Doe',
    phone: '01234567890',
    address: '123 Test Street, Cairo, Egypt',
    governorate: 'cairo'
  },
  admin: {
    email: 'admin@nerve.com',
    password: 'admin123',
    role: 'admin'
  },
  existing: {
    email: 'existing@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith'
  }
}

export const testProducts = {
  tshirt: {
    id: 'test-tshirt-1',
    name: 'Test T-Shirt',
    price: 299.99,
    category: 'T-Shirts',
    colors: ['Black', 'White', 'Red'],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    description: 'Premium cotton test t-shirt',
    material: '100% Cotton'
  },
  hoodie: {
    id: 'test-hoodie-1', 
    name: 'Test Hoodie',
    price: 599.99,
    category: 'Hoodies',
    colors: ['Black', 'Grey'],
    sizes: ['S', 'M', 'L', 'XL'],
    description: 'Comfortable test hoodie',
    material: '80% Cotton, 20% Polyester'
  }
}

export const testOrders = {
  pending: {
    id: 'test-order-pending-1',
    status: 'pending',
    total: 899.97,
    items: [
      { productId: 'test-tshirt-1', quantity: 2, size: 'M', color: 'Black' },
      { productId: 'test-hoodie-1', quantity: 1, size: 'L', color: 'Grey' }
    ],
    customer: testUsers.customer,
    paymentMethod: 'cod',
    shippingFee: 50
  },
  shipped: {
    id: 'test-order-shipped-1',
    status: 'shipped',
    total: 349.99,
    items: [
      { productId: 'test-tshirt-1', quantity: 1, size: 'L', color: 'White' }
    ],
    customer: testUsers.existing,
    paymentMethod: 'card',
    shippingFee: 50,
    trackingNumber: 'TRK123456789'
  }
}

export const testDiscounts = {
  percentage: {
    code: 'TEST10',
    type: 'percentage',
    value: 10,
    minimumAmount: 200,
    usageLimit: 100,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    active: true
  },
  fixed: {
    code: 'SAVE50',
    type: 'fixed',
    value: 50,
    minimumAmount: 500,
    usageLimit: 50,
    validFrom: '2024-01-01',
    validUntil: '2024-12-31',
    active: true
  },
  expired: {
    code: 'EXPIRED20',
    type: 'percentage',
    value: 20,
    minimumAmount: 100,
    usageLimit: 10,
    validFrom: '2023-01-01',
    validUntil: '2023-12-31',
    active: false
  }
}

export const testPaymentData = {
  validCard: {
    number: '4111111111111111',
    expiry: '12/25',
    cvc: '123',
    holderName: 'Test User'
  },
  invalidCard: {
    number: '1234567890123456',
    expiry: '01/20',
    cvc: '000',
    holderName: 'Invalid User'
  }
}

export const maliciousInputs = {
  xss: [
    '<script>alert("XSS")</script>',
    'javascript:alert(1)',
    '<img src="x" onerror="alert(1)">',
    '<svg onload="alert(1)">',
    '"><script>alert(1)</script>',
    'onmouseover=alert(1)',
    '{{constructor.constructor("alert(1)")()'
  ],
  sql: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "1; DELETE FROM products WHERE 1=1; --",
    "' UNION SELECT * FROM admin_users --",
    "1' OR 1=1#"
  ],
  overflow: [
    'A'.repeat(10000),
    'X'.repeat(100000),
    '🚀'.repeat(5000), // Unicode overflow
    '\n'.repeat(1000), // Newline flood
    ' '.repeat(50000) // Whitespace overflow
  ],
  specialChars: [
    '../../etc/passwd',
    '..\\..\\windows\\system32',
    '${7*7}',
    '#{7*7}',
    '{{7*7}}',
    '%{7*7}',
    '<%= 7*7 %>'
  ]
}

export const validationTestData = {
  emails: {
    valid: [
      'test@example.com',
      'user.name@domain.co.uk',
      'user+tag@example.org',
      '123@test.com',
      'test-user@example-domain.com'
    ],
    invalid: [
      'invalid',
      '@domain.com',
      'user@',
      'user..name@domain.com',
      'user@domain',
      '',
      'user@domain.c',
      'user name@domain.com'
    ]
  },
  phones: {
    valid: [
      '01234567890',
      '+201234567890',
      '01012345678',
      '01112345678',
      '01212345678'
    ],
    invalid: [
      '123',
      'abc123456789',
      '+++++++++++',
      '00000000000',
      '123456789012345',
      ''
    ]
  },
  passwords: {
    strong: [
      'StrongP@ss123!',
      'MySecur3P@ssw0rd',
      'T3st1ng!@#$%',
      'P@ssw0rd2024!'
    ],
    weak: [
      '123',
      'password',
      '12345678',
      'qwerty',
      'abc123',
      'Password123'
    ]
  }
}

export const performanceTestData = {
  largeDatasets: {
    products: Array.from({ length: 1000 }, (_, i) => ({
      id: `perf-product-${i}`,
      name: `Performance Test Product ${i}`,
      price: Math.random() * 1000,
      category: ['T-Shirts', 'Hoodies', 'Pants'][i % 3],
      inStock: Math.random() > 0.1
    })),
    orders: Array.from({ length: 500 }, (_, i) => ({
      id: `perf-order-${i}`,
      total: Math.random() * 2000,
      status: ['pending', 'processing', 'shipped', 'delivered'][i % 4],
      customerEmail: `customer${i}@test.com`,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    }))
  }
}

// Helper functions for test data
export const createTestUser = (overrides: Partial<typeof testUsers.customer> = {}) => ({
  ...testUsers.customer,
  ...overrides,
  email: `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`
})

export const createTestOrder = (overrides: Partial<typeof testOrders.pending> = {}) => ({
  ...testOrders.pending,
  ...overrides,
  id: `test-order-${Date.now()}-${Math.random().toString(36).substring(7)}`
})

export const createTestProduct = (overrides: Partial<typeof testProducts.tshirt> = {}) => ({
  ...testProducts.tshirt,
  ...overrides,
  id: `test-product-${Date.now()}-${Math.random().toString(36).substring(7)}`
})

export const createTestDiscount = (overrides: Partial<typeof testDiscounts.percentage> = {}) => ({
  ...testDiscounts.percentage,
  ...overrides,
  code: `TEST-${Date.now().toString().slice(-6)}`
})