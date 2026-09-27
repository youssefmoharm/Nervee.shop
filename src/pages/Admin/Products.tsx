import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { logError } from '../../lib/sentry';
import { LOW_STOCK_DEFAULT_THRESHOLD } from '../../lib/storeConfig';
import AdminLayout from './AdminLayout';
import { formatEGP } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  is_active: boolean;
  is_best_seller: boolean;
  product_inventory: { size: string; stock_quantity: number }[];
}

const PAGE_SIZE = 25;

export default function Products() {
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [refreshTick, setRefreshTick] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    adminService
      .listProducts(
        page,
        PAGE_SIZE,
        appliedSearch || undefined,
        statusFilter === 'all' ? undefined : statusFilter === 'active',
      )
      .then(result => {
        if (cancelled) return;
        setProducts(result.data as ProductRow[]);
        setTotal(result.total);
      })
      .catch(err => logError('Failed to load products', err));
    return () => {
      cancelled = true;
    };
  }, [page, appliedSearch, statusFilter, refreshTick]);

  // Debounce search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // FLOW-07: surface the result instead of silently reloading after a
  // (possibly failed) delete; products with order history are hidden, not erased.
  const remove = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}"? Products with past orders are hidden from the store instead of erased; the rest are permanently deleted.`,
      )
    ) {
      return;
    }
    const { error, hidden } = await adminService.deleteProduct(id);
    if (error) {
      logError('Failed to delete product', new Error(error), { productId: id });
      showToast(`Failed to delete "${name}". Please try again.`, 'error');
      return;
    }
    showToast(
      hidden ? `"${name}" is hidden from the store (it has order history).` : `"${name}" deleted.`,
      'success',
    );
    setRefreshTick(t => t + 1);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="nv-heading text-4xl">Products</h1>
        <Link
          to="/admin/products/new"
          data-testid="new-product-link"
          className="bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors text-center"
        >
          + New Product
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          data-testid="products-search-input"
          aria-label="Search products"
          className="flex-1 border border-navy/20 px-4 py-2 text-sm focus:outline-none focus:border-navy"
        />
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'hidden');
            setPage(1);
          }}
          aria-label="Filter products by visibility"
          data-testid="products-status-filter"
          className="border border-navy/20 px-3 py-2 text-sm"
        >
          <option value="all">All</option>
          <option value="active">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {!products ? (
        <Loader2 className="animate-spin text-navy/60" size={20} />
      ) : products.length === 0 ? (
        <p className="text-navy/60" data-testid="products-empty">
          No products found.
        </p>
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm" data-testid="products-table">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Name</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Category</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Price</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Total Stock</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {products.map(p => {
                const totalStock = (p.product_inventory ?? []).reduce(
                  (sum, i) => sum + i.stock_quantity,
                  0,
                );
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">
                      {p.name}
                      {!p.is_active && (
                        <span
                          data-testid="hidden-badge"
                          className="ms-2 inline-block bg-mist text-navy/70 text-[10px] px-1.5 py-0.5 rounded align-middle"
                        >
                          Hidden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-navy/70">{p.category}</td>
                    <td className="px-4 py-3">{formatEGP(p.price)}</td>
                    <td
                      className={`px-4 py-3 ${
                        totalStock <= LOW_STOCK_DEFAULT_THRESHOLD * 2
                          ? 'text-red-600'
                          : 'text-navy/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{totalStock}</span>
                        {totalStock <= 3 && (
                          <span className="inline-block bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            CRITICAL
                          </span>
                        )}
                        {totalStock > 3 && totalStock <= LOW_STOCK_DEFAULT_THRESHOLD && (
                          <span className="inline-block bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-medium">
                            LOW
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <Link
                          to={`/admin/products/${p.id}`}
                          aria-label="Edit"
                          className="text-navy/60 hover:text-navy"
                        >
                          <Pencil size={15} />
                        </Link>
                        <button
                          aria-label="Delete"
                          onClick={() => remove(p.id, p.name)}
                          className="text-navy/60 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && products && products.length > 0 && (
        <div
          className="flex items-center justify-between text-sm text-navy/70 mt-4"
          data-testid="products-pagination"
        >
          <span>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="border border-navy/20 px-3 py-1.5 disabled:opacity-40 hover:bg-mist"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="border border-navy/20 px-3 py-1.5 disabled:opacity-40 hover:bg-mist"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
