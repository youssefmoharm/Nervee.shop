import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import TryOnExperience from '../../components/TryOnExperience';
import ARTryOn from '../../components/ARTryOn';
import VirtualTryOnButton from '../../components/VirtualTryOnButton';
import TryOnQrPanel from '../../components/TryOnQrPanel';
import { staticTryOnOverrides } from '../../data/tryOnCatalog';
import type { Product } from '../../types';

const REAL_CONFIG = {
  enabled: true as const,
  lensId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  lensGroupId: 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6',
};

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

beforeEach(() => {
  for (const key of Object.keys(staticTryOnOverrides)) {
    delete staticTryOnOverrides[key];
  }
  window.history.replaceState({}, '', '/');
  vi.stubEnv('VITE_SNAPCHAT_API_TOKEN', 'test-token');
  vi.stubEnv('VITE_SNAPCHAT_LENS_GROUP_ID', 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6');
  // jsdom reports empty getClientRects for everything, which makes
  // focus-trap believe there are no tabbable nodes; give every element real
  // geometry so the modal's focus trap can activate (standard jsdom shim).
  const rect = {
    width: 100,
    height: 50,
    top: 0,
    left: 0,
    bottom: 50,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    value: () => [rect],
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    value: () => rect,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('TryOnExperience — product without AR', () => {
  it('shows the unavailable state, never the camera UI', async () => {
    render(<TryOnExperience product={product()} onClose={() => {}} />);
    await waitFor(() => {
      expect(
        screen.getByText(/Virtual Try-On is not available for this product yet/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Open AR Experience/i)).not.toBeInTheDocument();
    // No QR code is rendered when there is no valid configured destination.
    expect(screen.queryByTitle(/Scan to try on/i)).not.toBeInTheDocument();
  });
});

describe('TryOnExperience — QR fallback (jsdom lacks WebGL2/userMedia)', () => {
  it('shows a real QR pointing at this product AR page + official Snapchat fallback', async () => {
    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    render(<TryOnExperience product={product()} onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText((_, element) => element?.textContent === 'See NERVE OVERSIZED TEE in AR'),
      ).toBeInTheDocument();
    });
    // QR is rendered (qrcode.react SVG) — not a placeholder icon.
    expect(document.querySelector('svg')).not.toBeNull();
    // The panel communicates the scan flow for this specific product.
    expect(screen.getAllByText(/NERVE OVERSIZED TEE/i).length).toBeGreaterThan(0);
    // Official Snapchat lens CTA is present and real.
    const openLens = screen.getByRole('button', { name: /Open Snapchat Lens/i });
    expect(openLens).toBeInTheDocument();
  });

  it('CTA button for products without lens never appears', () => {
    render(<TryOnExperience product={product()} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Open Snapchat Lens/i })).not.toBeInTheDocument();
  });
});

describe('ARTryOn modal shell', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ARTryOn isOpen={false} onClose={() => {}} product={product()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the product-titled dialog when open', async () => {
    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    render(<ARTryOn isOpen onClose={() => {}} product={product()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Try On NERVE OVERSIZED TEE/i)).toBeInTheDocument();
    // Accessible close control with the required label.
    const closeButtons = screen.getAllByRole('button', { name: /Close Virtual Try-On/i });
    expect(closeButtons.length).toBeGreaterThan(0);
  });
});

describe('VirtualTryOnButton gating', () => {
  it('renders nothing without config; renders with config', () => {
    const { container } = render(<VirtualTryOnButton product={product()} onClick={() => {}} />);
    expect(container.firstChild).toBeNull();
    cleanup();

    staticTryOnOverrides['p-002'] = REAL_CONFIG;
    render(<VirtualTryOnButton product={product()} onClick={() => {}} />);
    expect(
      screen.getByRole('button', { name: /Try on NERVE OVERSIZED TEE in AR/i }),
    ).toBeInTheDocument();
  });
});

describe('TryOnQrPanel URL safety', () => {
  it('refuses to render a QR for non-http URLs (no fake codes)', () => {
    const { container } = render(<TryOnQrPanel targetUrl="not-a-url" productName="X" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a scannable SVG QR for a valid absolute URL', () => {
    const { container } = render(
      <TryOnQrPanel
        targetUrl="https://www.nerveey.shop/ar/nerve-oversized-tee"
        productName="NERVE OVERSIZED TEE"
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector('path')).not.toBeNull();
  });
});
