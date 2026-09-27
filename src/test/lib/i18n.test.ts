import { describe, expect, it } from 'vitest';
import { interpolate } from '../../lib/i18n';

describe('interpolate', () => {
  it('substitutes named placeholders', () => {
    expect(interpolate('Showing {shown} of {total} products', { shown: 3, total: 12 })).toBe(
      'Showing 3 of 12 products',
    );
  });

  it('leaves unknown placeholders untouched instead of rendering undefined', () => {
    expect(interpolate('{count} remaining', {})).toBe('{count} remaining');
    expect(interpolate('Hi {name}', { other: 'x' })).toBe('Hi {name}');
  });

  it('returns the template unchanged when no vars are supplied', () => {
    expect(interpolate('Load More')).toBe('Load More');
    expect(interpolate('Load More', undefined)).toBe('Load More');
  });
});
