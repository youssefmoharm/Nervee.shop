import { describe, it, expect } from 'vitest'

// Input validation functions to test
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: 'Email is required' }
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' }
  }
  
  if (email.length > 254) {
    return { valid: false, error: 'Email too long' }
  }
  
  return { valid: true }
}

export function validatePhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: false, error: 'Phone number is required' }
  }
  
  const digitsOnly = phone.replace(/\D/g, '')
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { valid: false, error: 'Phone number must be 10-15 digits' }
  }
  
  return { valid: true }
}

export function validateSize(size: string): { valid: boolean; error?: string } {
  if (!size) {
    return { valid: false, error: 'Size is required' }
  }
  
  const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  if (!validSizes.includes(size)) {
    return { valid: false, error: 'Invalid size' }
  }
  
  return { valid: true }
}

export function validateColor(color: string): { valid: boolean; error?: string } {
  if (!color || color.trim().length === 0) {
    return { valid: false, error: 'Color is required' }
  }
  
  if (color.length > 50) {
    return { valid: false, error: 'Color name too long' }
  }
  
  return { valid: true }
}

export function validatePaymentMethod(method: string): { valid: boolean; error?: string } {
  if (!method) {
    return { valid: false, error: 'Payment method is required' }
  }
  
  const validMethods = ['cod', 'card']
  if (!validMethods.includes(method)) {
    return { valid: false, error: 'Invalid payment method' }
  }
  
  return { valid: true }
}

export function validateDeliveryMethod(method: string): { valid: boolean; error?: string } {
  if (!method) {
    return { valid: false, error: 'Delivery method is required' }
  }
  
  const validMethods = ['standard', 'express']
  if (!validMethods.includes(method)) {
    return { valid: false, error: 'Invalid delivery method' }
  }
  
  return { valid: true }
}

describe('Input Validation', () => {
  describe('validateEmail', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('test@example.com')).toEqual({ valid: true })
      expect(validateEmail('user+tag@domain.co.uk')).toEqual({ valid: true })
      expect(validateEmail('123@test.org')).toEqual({ valid: true })
    })

    it('rejects empty email', () => {
      expect(validateEmail('')).toEqual({
        valid: false,
        error: 'Email is required'
      })
    })

    it('rejects invalid format', () => {
      expect(validateEmail('invalid')).toEqual({
        valid: false,
        error: 'Invalid email format'
      })
      expect(validateEmail('invalid@')).toEqual({
        valid: false,
        error: 'Invalid email format'
      })
      expect(validateEmail('@invalid.com')).toEqual({
        valid: false,
        error: 'Invalid email format'
      })
    })

    it('rejects overly long emails', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(validateEmail(longEmail)).toEqual({
        valid: false,
        error: 'Email too long'
      })
    })
  })

  describe('validatePhone', () => {
    it('accepts valid phone numbers', () => {
      expect(validatePhone('1234567890')).toEqual({ valid: true })
      expect(validatePhone('+1-234-567-8900')).toEqual({ valid: true })
      expect(validatePhone('(555) 123-4567')).toEqual({ valid: true })
    })

    it('rejects empty phone', () => {
      expect(validatePhone('')).toEqual({
        valid: false,
        error: 'Phone number is required'
      })
    })

    it('rejects too short phone numbers', () => {
      expect(validatePhone('123456789')).toEqual({
        valid: false,
        error: 'Phone number must be 10-15 digits'
      })
    })

    it('rejects too long phone numbers', () => {
      expect(validatePhone('1234567890123456')).toEqual({
        valid: false,
        error: 'Phone number must be 10-15 digits'
      })
    })

    it('handles phone numbers with formatting', () => {
      expect(validatePhone('+20-123-456-7890')).toEqual({ valid: true })
    })
  })

  describe('validateSize', () => {
    it('accepts valid sizes', () => {
      const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
      validSizes.forEach(size => {
        expect(validateSize(size)).toEqual({ valid: true })
      })
    })

    it('rejects empty size', () => {
      expect(validateSize('')).toEqual({
        valid: false,
        error: 'Size is required'
      })
    })

    it('rejects invalid sizes', () => {
      expect(validateSize('XXXL')).toEqual({
        valid: false,
        error: 'Invalid size'
      })
      expect(validateSize('medium')).toEqual({
        valid: false,
        error: 'Invalid size'
      })
    })
  })

  describe('validateColor', () => {
    it('accepts valid colors', () => {
      expect(validateColor('Red')).toEqual({ valid: true })
      expect(validateColor('Navy Blue')).toEqual({ valid: true })
      expect(validateColor('Black')).toEqual({ valid: true })
    })

    it('rejects empty color', () => {
      expect(validateColor('')).toEqual({
        valid: false,
        error: 'Color is required'
      })
      expect(validateColor('   ')).toEqual({
        valid: false,
        error: 'Color is required'
      })
    })

    it('rejects overly long color names', () => {
      const longColor = 'a'.repeat(51)
      expect(validateColor(longColor)).toEqual({
        valid: false,
        error: 'Color name too long'
      })
    })
  })

  describe('validatePaymentMethod', () => {
    it('accepts valid payment methods', () => {
      expect(validatePaymentMethod('cod')).toEqual({ valid: true })
      expect(validatePaymentMethod('card')).toEqual({ valid: true })
    })

    it('rejects empty payment method', () => {
      expect(validatePaymentMethod('')).toEqual({
        valid: false,
        error: 'Payment method is required'
      })
    })

    it('rejects invalid payment methods', () => {
      expect(validatePaymentMethod('paypal')).toEqual({
        valid: false,
        error: 'Invalid payment method'
      })
      expect(validatePaymentMethod('crypto')).toEqual({
        valid: false,
        error: 'Invalid payment method'
      })
    })
  })

  describe('validateDeliveryMethod', () => {
    it('accepts valid delivery methods', () => {
      expect(validateDeliveryMethod('standard')).toEqual({ valid: true })
      expect(validateDeliveryMethod('express')).toEqual({ valid: true })
    })

    it('rejects empty delivery method', () => {
      expect(validateDeliveryMethod('')).toEqual({
        valid: false,
        error: 'Delivery method is required'
      })
    })

    it('rejects invalid delivery methods', () => {
      expect(validateDeliveryMethod('overnight')).toEqual({
        valid: false,
        error: 'Invalid delivery method'
      })
      expect(validateDeliveryMethod('pickup')).toEqual({
        valid: false,
        error: 'Invalid delivery method'
      })
    })
  })
})