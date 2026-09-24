/**
 * Egyptian-specific validation utilities for checkout
 *
 * Validates:
 * - Phone numbers (Egyptian carriers only: Vodafone, Orange, Etisalat, Telecom Egypt)
 * - Governorates (27 valid Egyptian governorates)
 * - Postal codes (Egyptian format)
 * - Address length and content
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string; // Normalized value (e.g., phone without spaces)
}

/**
 * Validate an email address (shared by checkout, tests, and forms).
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email.' };
  }
  return { valid: true, normalized: trimmed.toLowerCase() };
}

/**
 * Validate Egyptian phone number
 * Accepts formats:
 * - 01012345678 (11 digits, Vodafone)
 * - +20 101 2345 678 (with country code)
 * - 20101 2345 678 (spaces)
 *
 * Validates carrier prefix:
 * - 010/011 = Vodafone (2G, 3G, 4G, 5G)
 * - 012 = Orange (2G, 3G, 4G, 5G)
 * - 015 = Etisalat (2G, 3G, 4G, 5G)
 * - 016 = Telecom Egypt (3G, 4G)
 */
export function validateEgyptianPhone(phone: string): ValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Remove whitespace and hyphens
  const cleaned = phone.trim().replace(/[\s-]+/g, '');

  // Remove country code if present
  let normalized: string;
  if (cleaned.startsWith('+20')) {
    normalized = '0' + cleaned.slice(3); // +201012345678 → 01012345678
  } else if (cleaned.startsWith('0020')) {
    normalized = '0' + cleaned.slice(4); // 00201012345678 → 01012345678
  } else if (cleaned.startsWith('20')) {
    normalized = '0' + cleaned.slice(2); // 201012345678 → 01012345678
  } else {
    normalized = cleaned;
  }

  // Egyptian mobile: 11 digits starting with 01 (010/011/012/013/015/016/017/018/019)
  if (!/^01\d{9}$/.test(normalized)) {
    return {
      valid: false,
      error: 'Enter a valid Egyptian mobile number (11 digits starting with 01)',
    };
  }

  return { valid: true, normalized };
}

/**
 * Validate Egyptian postal code (optional field)
 * Format: 4-5 digits or postcode pattern
 */
export function validateEgyptianPostalCode(postal: string): ValidationResult {
  if (!postal) {
    return { valid: true }; // Optional field
  }

  if (!/^[0-9]{4,5}$/.test(postal.trim())) {
    return { valid: false, error: 'Postal code must be 4-5 digits' };
  }

  return { valid: true, normalized: postal.trim() };
}

/**
 * Validate shipping address
 * - Must be 10-200 characters
 * - Cannot contain only numbers
 * - Cannot contain URLs/emails
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const trimmed = address.trim();

  if (trimmed.length < 10) {
    return { valid: false, error: 'Address must be at least 10 characters' };
  }

  if (trimmed.length > 200) {
    return { valid: false, error: 'Address must not exceed 200 characters' };
  }

  // Check for URLs or emails
  if (/https?:\/\/|@/.test(trimmed)) {
    return { valid: false, error: 'Address cannot contain URLs or emails' };
  }

  // Must contain at least some letters (not just numbers)
  if (!/[a-zA-Z\u0600-\u06FF]/.test(trimmed)) {
    return { valid: false, error: 'Address must contain at least some text' };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Validate city name
 * - 2-50 characters
 * - Letters only (+ spaces, hyphens)
 */
export function validateCity(city: string): ValidationResult {
  if (!city || typeof city !== 'string') {
    return { valid: false, error: 'City is required' };
  }

  const trimmed = city.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'City must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'City must not exceed 50 characters' };
  }

  // Allow letters (English + Arabic), spaces, hyphens
  if (!/^[a-zA-Z\u0600-\u06FF\s-]+$/.test(trimmed)) {
    return { valid: false, error: 'City must contain only letters, spaces, or hyphens' };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Validate Egyptian governorate
 * Canonical list lives in src/data/governorates.ts
 */
export { EGYPT_GOVERNORATES } from '../data/governorates';
import { EGYPT_GOVERNORATES } from '../data/governorates';

export function validateGovernorate(governorate: string): ValidationResult {
  if (!governorate || typeof governorate !== 'string') {
    return { valid: false, error: 'Governorate is required' };
  }

  const trimmed = governorate.trim();

  if (!(EGYPT_GOVERNORATES as readonly string[]).includes(trimmed)) {
    return {
      valid: false,
      error: 'Please select a valid Egyptian governorate',
      normalized: EGYPT_GOVERNORATES[0], // Fallback suggestion
    };
  }

  return { valid: true, normalized: trimmed };
}

/**
 * Batch validate entire checkout form
 */
export interface CheckoutValidation {
  phone: ValidationResult;
  address: ValidationResult;
  city: ValidationResult;
  governorate: ValidationResult;
  postalCode?: ValidationResult;
}

export function validateCheckoutForm(data: {
  phone: string;
  address: string;
  city: string;
  governorate: string;
  postalCode?: string;
}): CheckoutValidation {
  return {
    phone: validateEgyptianPhone(data.phone),
    address: validateAddress(data.address),
    city: validateCity(data.city),
    governorate: validateGovernorate(data.governorate),
    postalCode: data.postalCode ? validateEgyptianPostalCode(data.postalCode) : undefined,
  };
}

/**
 * Check if validation passed (all fields valid)
 */
export function isCheckoutFormValid(validation: CheckoutValidation): boolean {
  return (
    validation.phone.valid &&
    validation.address.valid &&
    validation.city.valid &&
    validation.governorate.valid &&
    (!validation.postalCode || validation.postalCode.valid)
  );
}

/**
 * Get all validation error messages
 */
export function getCheckoutValidationErrors(validation: CheckoutValidation): string[] {
  const errors: string[] = [];
  if (!validation.phone.valid && validation.phone.error) errors.push(validation.phone.error);
  if (!validation.address.valid && validation.address.error) errors.push(validation.address.error);
  if (!validation.city.valid && validation.city.error) errors.push(validation.city.error);
  if (!validation.governorate.valid && validation.governorate.error)
    errors.push(validation.governorate.error);
  if (validation.postalCode && !validation.postalCode.valid && validation.postalCode.error)
    errors.push(validation.postalCode.error);
  return errors;
}
