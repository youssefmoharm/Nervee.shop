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

  // Remove all whitespace
  const cleaned = phone.trim().replace(/\s+/g, '');

  // Remove country code if present
  let normalized: string;
  if (cleaned.startsWith('+20')) {
    normalized = '0' + cleaned.slice(3); // +201012345678 → 01012345678
  } else if (cleaned.startsWith('20')) {
    normalized = '0' + cleaned.slice(2); // 201012345678 → 01012345678
  } else {
    normalized = cleaned;
  }

  // Must be exactly 11 digits
  if (!/^\d{11}$/.test(normalized)) {
    return { valid: false, error: 'Phone number must be 11 digits' };
  }

  // First two digits must be 01 (Egypt prefix)
  if (!normalized.startsWith('01')) {
    return { valid: false, error: 'Invalid phone format (must start with 01)' };
  }

  // Third digit determines carrier
  const carrierDigit = normalized[2];
  const validCarriers = ['0', '1', '2', '5', '6']; // 010, 011, 012, 015, 016

  if (!validCarriers.includes(carrierDigit)) {
    return {
      valid: false,
      error: 'Invalid carrier (use Vodafone, Orange, Etisalat, or Telecom Egypt)',
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
 * Must be from the list of 27 valid governorates
 */
export const EGYPTIAN_GOVERNORATES = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Damnhour',
  'Kafr El-Sheikh',
  'Ismailia',
  'Port Said',
  'Suez',
  'Minya',
  'Beni Suef',
  'Fayoum',
  'Asyut',
  'Sohag',
  'Luxor',
  'Aswan',
  'Qena',
  'Red Sea',
  'Matrouh',
  'North Sinai',
  'South Sinai',
  'New Valley',
  'Helwan',
  'El-Jiza',
  'Qalyubia',
  'Sharqia',
  'Gharbia',
];

export function validateGovernorate(governorate: string): ValidationResult {
  if (!governorate || typeof governorate !== 'string') {
    return { valid: false, error: 'Governorate is required' };
  }

  const trimmed = governorate.trim();

  if (!EGYPTIAN_GOVERNORATES.includes(trimmed)) {
    return {
      valid: false,
      error: 'Please select a valid Egyptian governorate',
      normalized: EGYPTIAN_GOVERNORATES[0], // Fallback suggestion
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
