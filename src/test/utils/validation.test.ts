import { describe, it, expect } from 'vitest';
import {
  validateEgyptianPhone,
  validateEgyptianPostalCode,
  validateGovernorate,
  validateCity,
  validateAddress,
  validateEmail,
} from '../../lib/egyptianValidation';

describe('Input validation (production sources only)', () => {
  describe('validateEmail (lib/egyptianValidation)', () => {
    it('accepts valid emails', () => {
      expect(validateEmail('test@example.com').valid).toBe(true);
      expect(validateEmail('user+tag@domain.co.uk').valid).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(validateEmail('').valid).toBe(false);
      expect(validateEmail('invalid').valid).toBe(false);
      expect(validateEmail('invalid@').valid).toBe(false);
      expect(validateEmail('@invalid.com').valid).toBe(false);
    });
  });

  describe('Egyptian phone (lib/egyptianValidation)', () => {
    it('accepts normalized Egyptian mobiles', () => {
      expect(validateEgyptianPhone('01012345678').valid).toBe(true);
      expect(validateEgyptianPhone('+20 101 234 5678').valid).toBe(true);
      expect(validateEgyptianPhone('01234567890').valid).toBe(true);
      expect(validateEgyptianPhone('01501234567').valid).toBe(true);
    });

    it('rejects empty, short, long, and non-Egyptian numbers', () => {
      expect(validateEgyptianPhone('').valid).toBe(false);
      expect(validateEgyptianPhone('123456789').valid).toBe(false);
      expect(validateEgyptianPhone('1234567890123456').valid).toBe(false);
      expect(validateEgyptianPhone('+1-234-567-8900').valid).toBe(false);
      expect(validateEgyptianPhone('(555) 123-4567').valid).toBe(false);
    });
  });

  describe('postal code', () => {
    it('accepts optional 4-5 digit codes', () => {
      expect(validateEgyptianPostalCode('').valid).toBe(true);
      expect(validateEgyptianPostalCode('1234').valid).toBe(true);
      expect(validateEgyptianPostalCode('12345').valid).toBe(true);
    });

    it('rejects non-numeric codes', () => {
      expect(validateEgyptianPostalCode('123456').valid).toBe(false);
      expect(validateEgyptianPostalCode('abcd').valid).toBe(false);
    });
  });

  describe('governorate', () => {
    it('accepts all canonical governorates', () => {
      expect(validateGovernorate('Cairo').valid).toBe(true);
      expect(validateGovernorate('Alexandria').valid).toBe(true);
      expect(validateGovernorate('Giza').valid).toBe(true);
    });

    it('rejects unknown governorates', () => {
      expect(validateGovernorate('Atlantis').valid).toBe(false);
      expect(validateGovernorate('').valid).toBe(false);
    });
  });

  describe('city / address', () => {
    it('validates city rules', () => {
      expect(validateCity('Cairo').valid).toBe(true);
      expect(validateCity('New Cairo').valid).toBe(true);
      expect(validateCity('X').valid).toBe(false);
      expect(validateCity('').valid).toBe(false);
    });

    it('validates address rules', () => {
      expect(validateAddress('15 Nile Corniche, Zamalek').valid).toBe(true);
      expect(validateAddress('short').valid).toBe(false);
      expect(validateAddress('email me@example.com here').valid).toBe(false);
    });
  });
});
