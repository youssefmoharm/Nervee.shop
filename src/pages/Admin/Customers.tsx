import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { logError } from '../../lib/sentry';
import AdminLayout from './AdminLayout';

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminService
      .listCustomers(page, PAGE_SIZE, appliedSearch || undefined)
      .then(result => {
        if (cancelled) return;
        setCustomers(result.data as Customer[]);
        setTotal(result.total);
      })
      .catch(err => logError('Failed to load customers', err));
    return () => {
      cancelled = true;
    };
  }, [page, appliedSearch]);

  // Debounce search so typing doesn't fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-8">Customers</h1>

      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        data-testid="customers-search-input"
        aria-label="Search customers"
        className="w-full sm:max-w-md border border-navy/20 px-4 py-2 text-sm mb-4 focus:outline-none focus:border-navy"
      />

      {!customers ? (
        <Loader2 className="animate-spin text-navy/60" size={20} />
      ) : customers.length === 0 ? (
        <p className="text-navy/60" data-testid="customers-empty">
          {appliedSearch ? 'No customers match your search.' : 'No customers yet.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto border border-navy/10">
            <table className="w-full text-sm" data-testid="customers-table">
              <thead className="bg-mist/50 text-left">
                <tr>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Name</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Email</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Phone</th>
                  <th className="px-4 py-3 nv-eyebrow text-[10px]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy/10">
                {customers.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`/admin/customers/${c.id}`} className="text-navy hover:underline">
                        {c.first_name || c.last_name
                          ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
                          : '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy/70">{c.email}</td>
                    <td className="px-4 py-3 text-navy/70">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-navy/70">
                      {new Date(c.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div
              className="flex items-center justify-between text-sm text-navy/70 mt-4"
              data-testid="customers-pagination"
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
