import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { logError } from '../../lib/sentry';
import AdminLayout from './AdminLayout';
import { formatEGP } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import {
  ORDER_STATUSES,
  isIrreversible,
  isValidStatus,
  sanitizeSearchInput,
  validNextStatuses,
} from '../../lib/adminOrders';

interface OrderRow {
  id: string;
  order_number: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  total: number;
  status: string;
  payment_status: string;
  payment_provider: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? '';
  const filter = isValidStatus(statusParam) ? statusParam : '';
  const { showToast } = useToast();

  const setFilter = (status: string) => {
    const next = new URLSearchParams(searchParams);
    if (status) next.set('status', status);
    else next.delete('status');
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const load = useCallback(() => {
    adminService
      .listOrders(
        filter || undefined,
        appliedSearch || undefined,
        dateFrom || undefined,
        dateTo || undefined,
        page,
        PAGE_SIZE,
      )
      .then(result => {
        setOrders(result.data as OrderRow[]);
        setTotal(result.total);
      })
      .catch(err => logError('Failed to load orders', err));
  }, [filter, appliedSearch, dateFrom, dateTo, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(sanitizeSearchInput(searchQuery));
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const changeStatus = async (id: string, status: string, current: string) => {
    if (status === current) return;

    const validNext = validNextStatuses(current);
    if (!validNext.includes(status as (typeof ORDER_STATUSES)[number])) {
      showToast(
        `Invalid status transition. From "${current}", valid states are: ${
          validNext.join(', ') || 'none (terminal)'
        }`,
        'error',
        4000,
      );
      load();
      return;
    }

    // cancel/refund restock inventory server-side and cannot be undone
    // (AUDIT FLOW-09) — require an explicit confirmation with an optional
    // audit reason recorded in order_status_history.
    let reason: string | null = null;
    if (isIrreversible(status)) {
      const input = window.prompt(
        `Change order status from "${current}" to "${status}"?\n` +
          'This will restock inventory and cannot be undone.\n\n' +
          'Reason (stored in the audit log, optional):',
        '',
      );
      if (input === null) {
        load(); // re-render so the select snaps back to the stored status
        return;
      }
      reason = input.trim() || null;
    }

    const { error } = await adminService.updateOrderStatus(id, status, undefined, reason);
    if (error) {
      showToast(error, 'error', 5000);
      load();
      return;
    }
    showToast('Order status updated', 'success', 2500);
    load();
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="nv-heading text-4xl">Orders</h1>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Filter orders by status"
            className="border border-navy/20 px-3 py-2 text-sm"
            data-testid="order-status-filter"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map(s => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Search and Date Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by order number, email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="orders-search-input"
            className="flex-1 border border-navy/20 px-4 py-2 text-sm focus:outline-none focus:border-navy"
          />
          <input
            type="date"
            placeholder="From date"
            aria-label="From date"
            value={dateFrom}
            onChange={e => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="border border-navy/20 px-4 py-2 text-sm focus:outline-none focus:border-navy"
          />
          <input
            type="date"
            placeholder="To date"
            aria-label="To date"
            value={dateTo}
            onChange={e => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="border border-navy/20 px-4 py-2 text-sm focus:outline-none focus:border-navy"
          />
        </div>
      </div>

      {!orders ? (
        <Loader2 className="animate-spin text-navy/60" size={20} />
      ) : orders.length === 0 ? (
        <p className="text-navy/60">No orders found.</p>
      ) : (
        <>
          <div className="overflow-x-auto border border-navy/10">
            <table className="w-full text-sm" data-testid="orders-table">
              <thead className="bg-mist/50 text-left">
                <tr>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Order</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Date</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Email</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Total</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Payment</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {orders.map(o => {
                  const nextStatuses = validNextStatuses(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium">{o.order_number}</td>
                      <td className="px-4 py-3 text-navy/70 whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-navy/70">{o.email}</td>
                      <td className="px-4 py-3">{formatEGP(o.total)}</td>
                      <td className="px-4 py-3 text-navy/70 capitalize">
                        {o.payment_status}
                        {o.payment_provider ? (
                          <span className="text-navy/50"> · {o.payment_provider}</span>
                        ) : (
                          <span className="text-navy/50"> · COD</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          onChange={e => changeStatus(o.id, e.target.value, o.status)}
                          aria-label={`Status for order ${o.order_number}`}
                          data-testid={`order-status-${o.order_number}`}
                          className="border border-navy/20 px-2 py-1.5 text-xs"
                        >
                          {ORDER_STATUSES.map(s => {
                            const allowed = s === o.status || nextStatuses.includes(s);
                            return (
                              <option key={s} value={s} disabled={!allowed}>
                                {s}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div
              className="flex items-center justify-between text-sm text-navy/70"
              data-testid="orders-pagination"
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
        </>
      )}
    </AdminLayout>
  );
}
