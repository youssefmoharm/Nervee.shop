import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AdminLayout from './AdminLayout';

interface ReturnRow {
  id: string;
  order_id: string;
  type: string;
  reason: string;
  status: string;
  requested_at: string;
  orders?: { order_number: string; status: string; email: string; total: number };
}

export default function AdminReturns() {
  const [rows, setRows] = useState<ReturnRow[] | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'completed' | ''>(
    'pending',
  );

  const load = async () => {
    let q = supabase
      .from('order_return_requests')
      .select(
        'id, order_id, type, reason, status, requested_at, orders(order_number, status, email, total)',
      )
      .order('requested_at', { ascending: false })
      .limit(50);
    if (filter) q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      setRows([]);
      return;
    }
    setRows(data as unknown as ReturnRow[]);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const update = async (id: string, status: 'approved' | 'rejected' | 'completed') => {
    const { error } = await supabase
      .from('order_return_requests')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert(error.message);
    else load();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="nv-heading text-4xl">Returns</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="border border-navy/20 px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      {!rows ? (
        <Loader2 className="animate-spin text-navy/40" size={20} />
      ) : rows.length === 0 ? (
        <p className="text-navy/60">No requests.</p>
      ) : (
        <div className="overflow-x-auto border border-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-mist/50 text-left">
              <tr>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Order</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Type</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Reason</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Status</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]">Requested</th>
                <th className="px-4 py-3 nv-eyebrow text-[10px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">
                    {r.orders?.order_number || r.order_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 max-w-[260px] truncate" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-navy/60 text-xs">
                    {new Date(r.requested_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 flex gap-1 justify-end">
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => update(r.id, 'approved')}
                          className="bg-navy text-white px-3 py-1.5 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => update(r.id, 'rejected')}
                          className="border border-navy px-3 py-1.5 text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button
                        onClick={() => update(r.id, 'completed')}
                        className="border border-navy px-3 py-1.5 text-xs"
                      >
                        Mark Completed
                      </button>
                    )}
                    <a
                      href={`/admin/orders`}
                      className="px-2 py-1.5 text-xs text-navy/60 underline"
                    >
                      Orders
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-navy/40 mt-4">
        Approve → then go to Orders and set status to <span className="font-medium">refunded</span>{' '}
        or <span className="font-medium">cancelled</span> to restock inventory (once via
        update_order_status). One request per order/type enforced via UNIQUE.
      </p>
    </AdminLayout>
  );
}
