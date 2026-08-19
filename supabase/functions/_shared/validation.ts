/**
 * Comprehensive input validation utilities for Edge Functions
 * 
 * Provides secure server-side validation for all user inputs
 */

export interface ValidationError {
  field: string
  message: string
}

export class ValidationException extends Error {
  constructor(public errors: ValidationError[]) {
    super(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`)
    this.name = 'ValidationException'
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string, fieldName = 'email'): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!email || typeof email !== 'string') {
    errors.push({ field: fieldName, message: 'Email is required' })
    return errors
  }
  
  // Trim and check length
  email = email.trim()
  if (email.length > 254) {
    errors.push({ field: fieldName, message: 'Email too long (max 254 characters)' })
  }
  
  // RFC 5322 compliant regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(email)) {
    errors.push({ field: fieldName, message: 'Invalid email format' })
  }
  
  return errors
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string, fieldName = 'phone'): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!phone || typeof phone !== 'string') {
    errors.push({ field: fieldName, message: 'Phone number is required' })
    return errors
  }
  
  // Remove all non-digits
  const digitsOnly = phone.replace(/\D/g, '')
  
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    errors.push({ field: fieldName, message: 'Phone number must be 10-15 digits' })
  }
  
  return errors
}

/**
 * Validate name field (first name, last name, etc.)
 */
export function validateName(name: string, fieldName: string, required = true): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!name || typeof name !== 'string') {
    if (required) {
      errors.push({ field: fieldName, message: `${fieldName} is required` })
    }
    return errors
  }
  
  name = name.trim()
  
  if (name.length === 0 && required) {
    errors.push({ field: fieldName, message: `${fieldName} cannot be empty` })
    return errors
  }
  
  if (name.length > 100) {
    errors.push({ field: fieldName, message: `${fieldName} too long (max 100 characters)` })
  }
  
  // Allow only letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/
  if (name.length > 0 && !nameRegex.test(name)) {
    errors.push({ field: fieldName, message: `${fieldName} contains invalid characters` })
  }
  
  return errors
}

/**
 * Validate address
 */
export function validateAddress(address: string, fieldName = 'address'): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!address || typeof address !== 'string') {
    errors.push({ field: fieldName, message: 'Address is required' })
    return errors
  }
  
  address = address.trim()
  
  if (address.length === 0) {
    errors.push({ field: fieldName, message: 'Address cannot be empty' })
    return errors
  }
  
  if (address.length > 500) {
    errors.push({ field: fieldName, message: 'Address too long (max 500 characters)' })
  }
  
  return errors
}

/**
 * Validate city/governorate
 */
export function validateCity(city: string, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!city || typeof city !== 'string') {
    errors.push({ field: fieldName, message: `${fieldName} is required` })
    return errors
  }
  
  city = city.trim()
  
  if (city.length === 0) {
    errors.push({ field: fieldName, message: `${fieldName} cannot be empty` })
    return errors
  }
  
  if (city.length > 100) {
    errors.push({ field: fieldName, message: `${fieldName} too long (max 100 characters)` })
  }
  
  return errors
}

/**
 * Validate delivery method
 */
export function validateDeliveryMethod(method: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!method || typeof method !== 'string') {
    errors.push({ field: 'deliveryMethod', message: 'Delivery method is required' })
    return errors
  }
  
  const validMethods = ['standard', 'express']
  if (!validMethods.includes(method)) {
    errors.push({ field: 'deliveryMethod', message: 'Invalid delivery method' })
  }
  
  return errors
}

/**
 * Validate payment method
 */
export function validatePaymentMethod(method: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!method || typeof method !== 'string') {
    errors.push({ field: 'paymentMethod', message: 'Payment method is required' })
    return errors
  }
  
  const validMethods = ['cod', 'card']
  if (!validMethods.includes(method)) {
    errors.push({ field: 'paymentMethod', message: 'Invalid payment method' })
  }
  
  return errors
}

/**
 * Validate product size
 */
export function validateSize(size: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!size || typeof size !== 'string') {
    errors.push({ field: 'size', message: 'Size is required' })
    return errors
  }
  
  const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  if (!validSizes.includes(size)) {
    errors.push({ field: 'size', message: 'Invalid size' })
  }
  
  return errors
}

/**
 * Validate color name
 */
export function validateColor(color: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!color || typeof color !== 'string') {
    errors.push({ field: 'color', message: 'Color is required' })
    return errors
  }
  
  color = color.trim()
  
  if (color.length === 0) {
    errors.push({ field: 'color', message: 'Color cannot be empty' })
    return errors
  }
  
  if (color.length > 50) {
    errors.push({ field: 'color', message: 'Color name too long (max 50 characters)' })
  }
  
  return errors
}

/**
 * Validate quantity
 */
export function validateQuantity(quantity: any): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (quantity === undefined || quantity === null) {
    errors.push({ field: 'quantity', message: 'Quantity is required' })
    return errors
  }
  
  const num = Number(quantity)
  
  if (isNaN(num) || !Number.isInteger(num)) {
    errors.push({ field: 'quantity', message: 'Quantity must be a whole number' })
    return errors
  }
  
  if (num < 1) {
    errors.push({ field: 'quantity', message: 'Quantity must be at least 1' })
  }
  
  if (num > 10) {
    errors.push({ field: 'quantity', message: 'Maximum quantity per item is 10' })
  }
  
  return errors
}

/**
 * Validate discount code
 */
export function validateDiscountCode(code: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!code || typeof code !== 'string') {
    return errors // Discount code is optional
  }
  
  code = code.trim().toUpperCase()
  
  if (code.length > 20) {
    errors.push({ field: 'discountCode', message: 'Discount code too long (max 20 characters)' })
  }
  
  // Only allow alphanumeric characters
  const codeRegex = /^[A-Z0-9]+$/
  if (!codeRegex.test(code)) {
    errors.push({ field: 'discountCode', message: 'Discount code contains invalid characters' })
  }
  
  return errors
}

/**
 * Validate UUID format
 */
export function validateUUID(id: string, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!id || typeof id !== 'string') {
    errors.push({ field: fieldName, message: `${fieldName} is required` })
    return errors
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    errors.push({ field: fieldName, message: `Invalid ${fieldName} format` })
  }
  
  return errors
}

/**
 * Validate product ID (TEXT primary key, e.g. "p-001")
 */
export function validateProductId(id: string): ValidationError[] {
  const errors: ValidationError[] = []

  if (!id || typeof id !== 'string') {
    errors.push({ field: 'productId', message: 'Product ID is required' })
    return errors
  }

  if (id.trim().length === 0) {
    errors.push({ field: 'productId', message: 'Product ID cannot be empty' })
    return errors
  }

  if (id.length > 50) {
    errors.push({ field: 'productId', message: 'Product ID too long (max 50 characters)' })
  }

  const idRegex = /^[a-zA-Z0-9_-]+$/
  if (!idRegex.test(id)) {
    errors.push({ field: 'productId', message: 'Product ID contains invalid characters' })
  }

  return errors
}

/**
 * Validate cart items array
 */
export function validateCartItems(items: any): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!Array.isArray(items)) {
    errors.push({ field: 'items', message: 'Items must be an array' })
    return errors
  }
  
  if (items.length === 0) {
    errors.push({ field: 'items', message: 'Cart cannot be empty' })
    return errors
  }
  
  if (items.length > 50) {
    errors.push({ field: 'items', message: 'Too many items in cart (max 50)' })
    return errors
  }
  
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push({ field: `items[${index}]`, message: 'Invalid item format' })
      return
    }
    
    const prefix = `items[${index}].`
    const productIdErrors = validateProductId(item.productId).map(e => ({ ...e, field: prefix + e.field }))
    const colorErrors = validateColor(item.color).map(e => ({ ...e, field: prefix + e.field }))
    const sizeErrors = validateSize(item.size).map(e => ({ ...e, field: prefix + e.field }))
    const quantityErrors = validateQuantity(item.quantity).map(e => ({ ...e, field: prefix + e.field }))
    
    errors.push(
      ...productIdErrors,
      ...colorErrors,
      ...sizeErrors,
      ...quantityErrors
    )
  })
  
  return errors
}

/**
 * Sanitize text input to prevent XSS
 */
export function sanitizeText(text: string, maxLength = 1000): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  return text
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
}

/**
 * Validate complete order request
 */
export function validateOrderRequest(body: any): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'Request body is required' })
    return errors
  }
  
  errors.push(
    ...validateEmail(body.email),
    ...validateName(body.firstName, 'firstName'),
    ...validateName(body.lastName, 'lastName'),
    ...validatePhone(body.phone),
    ...validateAddress(body.address),
    ...validateCity(body.city, 'city'),
    ...validateCity(body.governorate, 'governorate'),
    ...validateDeliveryMethod(body.deliveryMethod),
    ...validatePaymentMethod(body.paymentMethod),
    ...validateDiscountCode(body.discountCode),
    ...validateCartItems(body.items)
  )
  
  return errors
}

/**
 * Validate and sanitize contact form
 */
export function validateContactForm(body: any): ValidationError[] {
  const errors: ValidationError[] = []
  
  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'Request body is required' })
    return errors
  }
  
  errors.push(
    ...validateName(body.name, 'name'),
    ...validateEmail(body.email)
  )
  
  // Validate subject
  if (!body.subject || typeof body.subject !== 'string') {
    errors.push({ field: 'subject', message: 'Subject is required' })
  } else if (body.subject.trim().length === 0) {
    errors.push({ field: 'subject', message: 'Subject cannot be empty' })
  } else if (body.subject.length > 200) {
    errors.push({ field: 'subject', message: 'Subject too long (max 200 characters)' })
  }
  
  // Validate message
  if (!body.message || typeof body.message !== 'string') {
    errors.push({ field: 'message', message: 'Message is required' })
  } else if (body.message.trim().length === 0) {
    errors.push({ field: 'message', message: 'Message cannot be empty' })
  } else if (body.message.length > 2000) {
    errors.push({ field: 'message', message: 'Message too long (max 2000 characters)' })
  }
  
  return errors
}

/**
 * Rate limit based on request body size to prevent payload bombs
 */
export function validateRequestSize(request: Request, maxSizeKB = 100): ValidationError[] {
  const errors: ValidationError[] = []
  
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const sizeMB = parseInt(contentLength, 10) / 1024
    if (sizeMB > maxSizeKB) {
      errors.push({ field: 'request', message: `Request too large (max ${maxSizeKB}KB)` })
    }
  }
  
  return errors
}