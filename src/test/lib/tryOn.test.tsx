import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { staticTryOnOverrides } from '../../data/tryOnCatalog';
import {
  normalizeTryOnConfig,
  resolveProductTryOnConfig,
  getTryOnSessionConfig,
  withTryOnConfig,
  classifyTryOnError,
  getSnapchatApiToken,
} from '../../lib/tryOnConfig';
import { lensUnlockUrl, lensShareUrl, detectDevice } from '../../lib/snapchat';
import type { Product } from '../../types';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-002',
  slug: 'nerve-oversized-tee',
  name: 'NERVE OVERSIZED TEE',
  category: 'T-Shirts',
  collectionId: 'street-form',
  price: 1250,
  currency: 'EGP',
  badge: null,
  description: '',
  material: '',
  care: [],
  gallery: [],
  isBestSeller: false,
  createdAt: '2026-06-10',
  colors: [],
  sizes: [],
  ...overrides,
});

const REAL_CONFIG = {
  enabled: true,
  lensId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  lensGroupId: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6',
};

describe('normalizeTryOnConfig', () => {
  it('accepts a valid config', () => {
    expect(normalizeTryOnConfig(REAL_CONFIG)).toEqual(REAL_CONFIG);
  });

  it('rejects disabled / empty / placeholder configs', () => {
    expect(normalizeTryOnConfig({ ...REAL_CONFIG, enabled: false })).toBeNull();
    expect(normalizeTryOnConfig({ enabled: true, lensId: '  ' })).toBeNull();
    expect(normalizeTryOnConfig({ enabled: true, lensId: 'YOUR_LENS_ID' })).toBeNull();
    expect(normalizeTryOnConfig({ enabled: true, lensId: 'PLACEHOLDER' })).toBeNull();
    expect(normalizeTryOnConfig(null)).toBeNull();
  });
});

describe('resolveProductTryOnConfig', () => {
  beforeEach(() => {
    // isolate static overrides between tests
    for (const key of Object.keys(staticTryOnOverrides)) {
      delete staticTryOnOverrides[key];
    }
  });

  it('uses the product-level config when present', () => {
    const p = product({ virtualTryOn: REAL_CONFIG });
    expect(resolveProductTryOnConfig(p)).toEqual(REAL_CONFIG);
  });

  it('falls back to the static catalog by product id', () => {
    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    expect(resolveProductTryOnConfig(product())).toEqual(REAL_CONFIG);
  });

  it('returns null (AR disabled) when nothing is configured', () => {
    // No env fallback in test env → no config → AR disabled.
    expect(resolveProductTryOnConfig(product())).toBeNull();
  });
});

describe('getTryOnSessionConfig', () => {
  it('errors with NO_LENS when the product has no AR config', () => {
    const result = getTryOnSessionConfig(product());
    expect('error' in result && result.error.code).toBe('NO_LENS');
  });

  it('errors with CONFIG_MISSING when the Snap API token is absent', () => {
    vi.stubEnv('VITE_SNAPCHAT_API_TOKEN', '');
    expect(getSnapchatApiToken()).toBeUndefined();
    const p = product({ virtualTryOn: REAL_CONFIG });
    const result = getTryOnSessionConfig(p);
    expect('error' in result && result.error.code).toBe('CONFIG_MISSING');
    vi.unstubAllEnvs();
  });
});

describe('classifyTryOnError', () => {
  it('maps permission denial to PERMISSION_DENIED', () => {
    const detail = classifyTryOnError(new DOMException('denied', 'NotAllowedError'));
    expect(detail.code).toBe('PERMISSION_DENIED');
  });

  it('maps a busy camera to PERMISSION_UNAVAILABLE', () => {
    const detail = classifyTryOnError(new DOMException('device in use', 'NotReadableError'));
    expect(detail.code).toBe('PERMISSION_UNAVAILABLE');
  });

  it('maps network failure to NETWORK', () => {
    expect(classifyTryOnError(new Error('fetch failed')).code).toBe('NETWORK');
  });

  it('maps lens failures to LENS_LOAD_FAILED', () => {
    expect(classifyTryOnError(new Error('Lens load failed')).code).toBe('LENS_LOAD_FAILED');
  });
});

describe('snapchat helper URLs', () => {
  it('builds the official unlock URL', () => {
    expect(lensUnlockUrl('abc')).toBe('https://www.snapchat.com/unlock/?type=SNAPCODE&uuid=abc');
  });

  it('builds the official share URL', () => {
    expect(lensShareUrl('abc')).toBe('https://www.snapchat.com/lens/abc');
  });
});

describe('withTryOnConfig', () => {
  it('attaches resolved config without mutating the input', () => {
    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    const p = product();
    const out = withTryOnConfig(p);
    expect(out.virtualTryOn).toEqual(REAL_CONFIG);
    expect(p.virtualTryOn).toBeUndefined();
  });
});

describe('VirtualTryOnButton gating', () => {
  beforeEach(() => {
    for (const key of Object.keys(staticTryOnOverrides)) {
      delete staticTryOnOverrides[key];
    }
  });
  afterEach(cleanup);

  it('renders nothing for products without AR', async () => {
    const { default: VirtualTryOnButton } = await import('../../components/VirtualTryOnButton');
    const { container } = render(<VirtualTryOnButton product={product()} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the button when AR is configured', async () => {
    const { default: VirtualTryOnButton } = await import('../../components/VirtualTryOnButton');
    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    render(<VirtualTryOnButton product={product()} onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: /try on nerve oversized tee in ar/i }),
    ).toBeInTheDocument();
  });
});

describe('VITE_TRYON_DEV_CONFIG sandbox', () => {
  const SANDBOX = {
    apiToken: 'sandbox-token',
    lenses: {
      'nerve-oversized-tee': { lensId: REAL_CONFIG.lensId, lensGroupId: REAL_CONFIG.lensGroupId },
      'p-003': { enabled: true, lensId: 'b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6' },
      'p-004': { enabled: true, lensId: 'YOUR_LENS_ID' },
      'p-005': { enabled: false, lensId: 'c1c2c3c4c5c6c7c8c9c0d1d2d3d4c5c6' },
    },
  };

  beforeEach(() => {
    for (const key of Object.keys(staticTryOnOverrides)) delete staticTryOnOverrides[key];
    vi.stubEnv('VITE_TRYON_DEV_CONFIG', JSON.stringify(SANDBOX));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves a sandbox lens by product slug', () => {
    expect(resolveProductTryOnConfig(product())).toEqual(REAL_CONFIG);
  });

  it('resolves a sandbox lens by product id', () => {
    const p = product({ id: 'p-003', slug: 'some-other-product' });
    expect(resolveProductTryOnConfig(p)?.lensId).toBe('b1b2b3b4b5b6b7b8b9b0c1c2c3c4c5c6');
  });

  it('takes precedence over product-level and static catalog config', () => {
    staticTryOnOverrides['p-002'] = { enabled: true, lensId: 'd1d2d3d4d5d6d7d8d9d0e1e2e3e4d5d6' };
    const p = product({
      virtualTryOn: { enabled: true, lensId: 'e1e2e3e4e5e6e7e8e9e0f1f2f3f4e5e6' },
    });
    expect(resolveProductTryOnConfig(p)).toEqual(REAL_CONFIG);
  });

  it('ignores disabled and placeholder sandbox entries', () => {
    expect(resolveProductTryOnConfig(product({ id: 'p-004', slug: 'p-004' }))).toBeNull();
    expect(resolveProductTryOnConfig(product({ id: 'p-005', slug: 'p-005' }))).toBeNull();
  });

  it('supplies the sandbox api token to the session config', () => {
    vi.stubEnv('VITE_SNAPCHAT_API_TOKEN', '');
    expect(getSnapchatApiToken()).toBe('sandbox-token');
    const result = getTryOnSessionConfig(product());
    expect('config' in result && result.config.lensGroupId).toBe(REAL_CONFIG.lensGroupId);
  });

  it('ignores malformed JSON instead of crashing resolution', () => {
    vi.stubEnv('VITE_TRYON_DEV_CONFIG', '{not json');
    expect(resolveProductTryOnConfig(product())).toBeNull();
    expect(resolveProductTryOnConfig(product({ virtualTryOn: REAL_CONFIG }))).toEqual(REAL_CONFIG);
  });
});

describe('detectDevice', () => {
  it('treats desktop UA as non-mobile', () => {
    Object.defineProperty(window, 'navigator', {
      value: { userAgent: 'Chrome/120', platform: 'Win32', maxTouchPoints: 0 },
      configurable: true,
    });
    Object.defineProperty(window, 'matchMedia', {
      value: () => ({ matches: false }),
      configurable: true,
    });
    expect(detectDevice().isMobile).toBe(false);
  });
});
