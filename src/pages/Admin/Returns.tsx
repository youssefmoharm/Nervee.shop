import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logError } from '../../lib/sentry';
import AdminLayout from './AdminLayout';
import { useToast } from '../../context/ToastContext';

interface ReturnRow {
  id: string;
  order_id: string;
  type: string;
  reason: string;
  status: string;
  requested_at: string;
  return_request_items?: Array<{
    quantity: number;
    replacement_size: string | null;
    order_items: { product_name: string; size: string };
  }>;
  orders?: { order_number: string; status: string; email: string; total: number };
}

export default function AdminReturns() {
  const [shipmentId, setShipmentId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [savingShipment, setSavingShipment] = useState(false);
  const [rows, setRows] = useState<ReturnRow[] | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'completed' | ''>(
    'pending',
  );
  const { showToast } = useToast();
  // Keep the toast fn out of the fetch callback's deps: a fresh identity every
  // render would re-run the effect forever (audit BUG-05).
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const load = useCallback(async () => {
    let q = supabase
      .from('order_return_requests')
      .select(
        'id, order_id, type, reason, status, requested_at, orders(order_number, status, email, total), return_request_items(quantity, replacement_size, order_items(product_name,size))',
      )
      .order('requested_at', { ascending: false })
      .limit(50);
    if (filter) q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) {
      logError('Failed to load return requests', error);
      showToastRef.current('Failed to load returns', 'error', 3000);
      setRows([]);
      return;
    }
    setRows(data as unknown as ReturnRow[]);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (
    id: string,
    status: 'approved' | 'rejected' | 'completed',
    current: string,
  ) => {
    if (status === current) return;
    // Approving/rejecting/completing resolves the request and is not
    // reversible from the UI (AUDIT FLOW-09).
    const ok = window.confirm(
      `Change return request from "${current}" to "${status}"? This cannot be undone.`,
    );
    if (!ok) return;
    const { error } = await supabase.rpc('resolve_return_request', {
      p_id: id,
      p_status: status,
      p_expected_status: current,
    });
    if (error) showToast(error.message, 'error', 4000);
    else {
      showToast(`Return ${status}`, 'success', 2500);
      await load();
    }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="nv-heading text-4xl">Returns</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          aria-label="Filter returns by status"
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
        <Loader2 className="animate-spin text-navy/60" size={20} />
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
                          onClick={() => update(r.id, 'approved', r.status)}
                          className="bg-navy text-white px-3 py-1.5 text-xs"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => update(r.id, 'rejected', r.status)}
                          className="border border-navy px-3 py-1.5 text-xs"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button
                        onClick={() => update(r.id, 'completed', r.status)}
                        className="border border-navy px-3 py-1.5 text-xs"
                      >
                        Mark Completed
                      </button>
                    )}
                    {r.type === 'exchange' && r.status === 'completed' && (
                      <button className="underline" onClick={() => setShipmentId(r.id)}>
                        Record shipment
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
      {shipmentId && (
        <form
          className="space-y-2 mt-4"
          onSubmit={async e => {
            e.preventDefault();
            if (savingShipment) return;
            setSavingShipment(true);
            try {
              const { error } = await supabase.rpc('record_exchange_shipment', {
                p_request_id: shipmentId,
                p_number: trackingNumber,
                p_url: trackingUrl,
              });
              if (error) showToast(error.message, 'error');
              else {
                setShipmentId('');
                setTrackingNumber('');
                setTrackingUrl('');
                showToast('Shipment recorded', 'success');
              }
            } catch {
              showToast('Could not record shipment. Try again.', 'error');
            } finally {
              setSavingShipment(false);
            }
          }}
        >
          <label className="block">
            Tracking number
            <input
              className="border p-2 ml-2"
              required
              maxLength={200}
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
            />
          </label>
          <label className="block">
            HTTPS tracking URL
            <input
              className="border p-2 ml-2"
              type="url"
              pattern="https://.*"
              required
              value={trackingUrl}
              onChange={e => setTrackingUrl(e.target.value)}
            />
          </label>
          <button className="bg-navy text-white p-2" disabled={savingShipment}>
            Save exchange shipment
          </button>
        </form>
      )}
      <p className="text-xs text-navy/60 mt-4">
        Complete a return after receiving the selected items. Only those quantities are restocked.
        Size exchanges reserve replacement stock atomically. Record cash repayments on the COD
        refunds page.
      </p>
    </AdminLayout>
  );
}
