/**
 * A/B Testing Infrastructure for NERVE
 * 
 * This module provides lightweight A/B testing functionality for front-end
 * experiments. It supports multiple variants, user assignment, and analytics
 * tracking.
 * 
 * Usage:
 * 
 * // In your component
 * const { variant, activate } = useABTest('checkout-button-color');
 * 
 * // variant will be 'control' | 'variant-a' | 'variant-b'
 * // activate() sends conversion event to analytics
 * 
 * // For programmatic access
 * const { variant, activate } = getABTest('checkout-button-color', userId);
 */

// A/B Test Definitions
export interface ABTestVariant {
  name: string;
  weight: number; // 0-100, represents percentage weight
  config?: Record<string, unknown>;
}

export interface ABTestDefinition {
  id: string;
  name: string;
  variants: ABTestVariant[];
  isActive: boolean;
  description?: string;
}

// Predefined A/B Tests
export const abTests: Record<string, ABTestDefinition> = {
  // Checkout button color test
  'checkout-button-color': {
    id: 'checkout-button-color',
    name: 'Checkout Button Color',
    description: 'Testing blue vs green checkout button colors',
    isActive: true,
    variants: [
      { name: 'control', weight: 50, config: { color: 'bg-blue-600', textColor: 'text-white' } },
      { name: 'variant-a', weight: 50, config: { color: 'bg-green-600', textColor: 'text-white' } },
    ],
  },
  
  // Product page layout test
  'product-page-layout': {
    id: 'product-page-layout',
    name: 'Product Page Layout',
    description: 'Testing new product page layout',
    isActive: true,
    variants: [
      { name: 'control', weight: 70, config: { layout: 'traditional' } },
      { name: 'variant-a', weight: 30, config: { layout: 'modern' } },
    ],
  },
  
  // Product card design test
  'product-card-design': {
    id: 'product-card-design',
    name: 'Product Card Design',
    description: 'Testing card design with hover effects',
    isActive: true,
    variants: [
      { name: 'control', weight: 50, config: { design: 'classic' } },
      { name: 'variant-a', weight: 25, config: { design: 'elevated' } },
      { name: 'variant-b', weight: 25, config: { design: 'minimal' } },
    ],
  },
  
  // Homepage hero test
  'homepage-hero': {
    id: 'homepage-hero',
    name: 'Homepage Hero Image',
    description: 'Testing different hero images',
    isActive: false,
    variants: [
      { name: 'control', weight: 33, config: { image: 'hero-1.jpg' } },
      { name: 'variant-a', weight: 33, config: { image: 'hero-2.jpg' } },
      { name: 'variant-b', weight: 33, config: { image: 'hero-3.jpg' } },
    ],
  },
};

/**
 * Generate a deterministic user ID from a string (for consistent assignment)
 */
function generateUserId(userId?: string): string {
  if (userId) return userId;
  // Generate a persistent user ID from localStorage or create new one
  let storedId = localStorage.getItem('nerve_user_id');
  if (!storedId) {
    storedId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('nerve_user_id', storedId);
  }
  return storedId;
}

/**
 * Assign a user to a variant using consistent hashing
 * This ensures the same user always gets the same variant
 */
function assignVariant(test: ABTestDefinition, userId: string): string {
  if (!test.isActive || test.variants.length === 0) {
    return test.variants[0]?.name || 'control';
  }

  // Create a hash of userId + testId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < test.id.length; i++) {
    hash = ((hash << 5) - hash) + test.id.charCodeAt(i);
    hash |= 0;
  }
  
  const normalizedHash = Math.abs(hash) / 2147483648; // Normalize to 0-1
  
  // Weighted random selection
  let cumulativeWeight = 0;
  for (const variant of test.variants) {
    cumulativeWeight += variant.weight / 100;
    if (normalizedHash < cumulativeWeight) {
      return variant.name;
    }
  }
  
  // Fallback to first variant
  return test.variants[0].name;
}

/**
 * Get the A/B test variant for a user
 */
export function getABTest(testId: string, userId?: string) {
  const test = abTests[testId];
  if (!test) {
    console.warn(`AB Test not found: ${testId}`);
    return { 
      variant: 'control',
      activate: () => {},
      config: {}
    };
  }

  const variantName = assignVariant(test, generateUserId(userId));
  const variant = test.variants.find(v => v.name === variantName) || test.variants[0];
  
  return {
    testId,
    variant: variantName,
    config: variant.config || {},
    activate: (conversionType: string = 'click') => {
      // Track conversion event
      trackABTestConversion(testId, variantName, conversionType);
    },
  };
}

/**
 * React hook for A/B test access
 */
export function useABTest(testId: string) {
  const { variant, config, activate } = getABTest(testId);
  
  // Send experiment exposure event
  React.useEffect(() => {
    trackABTestExposure(testId, variant);
  }, [testId, variant]);
  
  return { variant, config, activate };
}

/**
 * Track A/B test exposure
 */
function trackABTestExposure(testId: string, variant: string) {
  try {
    // Track via Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'ab_test_exposure', {
        test_id: testId,
        variant: variant,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Track via custom analytics
    console.log(`[AB Test] Exposure: ${testId} - Variant: ${variant}`);
  } catch (err) {
    console.error('Failed to track AB test exposure:', err);
  }
}

/**
 * Track A/B test conversion
 */
function trackABTestConversion(testId: string, variant: string, conversionType: string = 'click') {
  try {
    // Track via Google Analytics 4
    if (window.gtag) {
      window.gtag('event', 'ab_test_conversion', {
        test_id: testId,
        variant: variant,
        conversion_type: conversionType,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Track via custom analytics
    console.log(`[AB Test] Conversion: ${testId} - Variant: ${variant} - Type: ${conversionType}`);
  } catch (err) {
    console.error('Failed to track AB test conversion:', err);
  }
}

/**
 * Get the current variant for a test (read-only, no tracking)
 */
export function getABTestVariant(testId: string): string {
  const test = abTests[testId];
  if (!test) return 'control';
  return assignVariant(test, generateUserId());
}

/**
 * Utility to get all active tests
 */
export function getActiveABTests(): ABTestDefinition[] {
  return Object.values(abTests).filter(test => test.isActive);
}

// Re-export for convenience
import * as React from 'react';
