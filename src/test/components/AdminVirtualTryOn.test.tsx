import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VirtualTryOn from '../../pages/Admin/VirtualTryOn';
import { adminService } from '../../services/adminService';

// The admin layout only needs a signOut function during these tests.
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { email: 'admin@nerve.test' } }),
}));

vi.mock('../../services/adminService', () => ({
  adminService: {
    listProductsForTryOn: vi.fn(),
    updateProductVirtualTryOn: vi.fn(),
  },
}));

const LENS_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const GROUP_ID = 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6';

const products = [
  {
    id: 'p-002',
    name: 'NERVE OVERSIZED TEE',
    slug: 'nerve-oversized-tee',
    category: 'T-Shirts',
    is_active: true,
    virtual_try_on: null,
  },
  {
    id: 'p-003',
    name: 'CORE ZIP HOODIE',
    slug: 'core-zip-hoodie',
    category: 'Hoodies',
    is_active: true,
    virtual_try_on: { enabled: true, lensId: LENS_ID, lensGroupId: GROUP_ID },
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <VirtualTryOn />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminService.listProductsForTryOn).mockResolvedValue({
    data: products,
    error: null,
  } as never);
  vi.mocked(adminService.updateProductVirtualTryOn).mockResolvedValue({ error: null } as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Admin AR Try-On page', () => {
  it('lists products and shows which already have AR enabled', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('NERVE OVERSIZED TEE')).toBeInTheDocument();
    });
    expect(screen.getByText('CORE ZIP HOODIE')).toBeInTheDocument();
    // One of two products is live.
    expect(screen.getByText('AR enabled')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    // Existing config is loaded into the inputs so it can be edited.
    expect(screen.getByLabelText('Lens ID for CORE ZIP HOODIE')).toHaveValue(LENS_ID);
  });

  it('rejects a malformed lens ID without writing to the database', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('NERVE OVERSIZED TEE')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Enable AR for NERVE OVERSIZED TEE'));
    await user.type(screen.getByLabelText('Lens ID for NERVE OVERSIZED TEE'), 'not-a-lens');
    await user.type(screen.getByLabelText('Lens Group ID for NERVE OVERSIZED TEE'), GROUP_ID);
    await user.click(screen.getByTestId('save-p-002'));

    await waitFor(() => {
      expect(screen.getByTestId('errors-p-002')).toHaveTextContent(/32-character hex ID/);
    });
    expect(adminService.updateProductVirtualTryOn).not.toHaveBeenCalled();
  });

  it('saves a valid config as canonical jsonb', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('NERVE OVERSIZED TEE')).toBeInTheDocument());

    await user.click(screen.getByLabelText('Enable AR for NERVE OVERSIZED TEE'));
    await user.type(screen.getByLabelText('Lens ID for NERVE OVERSIZED TEE'), LENS_ID);
    await user.type(screen.getByLabelText('Lens Group ID for NERVE OVERSIZED TEE'), GROUP_ID);
    await user.click(screen.getByTestId('save-p-002'));

    await waitFor(() => {
      expect(adminService.updateProductVirtualTryOn).toHaveBeenCalledWith('p-002', {
        enabled: true,
        lensId: LENS_ID,
        lensGroupId: GROUP_ID,
      });
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('surfaces a database error instead of claiming success', async () => {
    vi.mocked(adminService.updateProductVirtualTryOn).mockResolvedValue({
      error: 'new row violates check constraint',
    } as never);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('CORE ZIP HOODIE')).toBeInTheDocument());

    await user.click(screen.getByTestId('save-p-003'));

    await waitFor(() => {
      expect(screen.getByTestId('errors-p-003')).toHaveTextContent(/check constraint/);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('clears AR by writing null', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('CORE ZIP HOODIE')).toBeInTheDocument());

    await user.click(screen.getAllByText('Clear AR')[0]);

    await waitFor(() => {
      expect(adminService.updateProductVirtualTryOn).toHaveBeenCalledWith('p-003', null);
    });
  });

  it('explains the missing column when the migration has not run', async () => {
    vi.mocked(adminService.listProductsForTryOn).mockResolvedValue({
      data: [],
      error: "Could not find the 'virtual_try_on' column of 'products' in the schema cache",
    } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('migration-warning')).toBeInTheDocument();
    });
    expect(screen.getByTestId('migration-warning')).toHaveTextContent(
      /024_product_virtual_try_on\.sql/,
    );
  });
});
