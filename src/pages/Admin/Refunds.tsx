import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from './AdminLayout';
import { formatEGP } from '../../lib/format';
interface Obligation {
  id: string;
  order_id: string;
  amount: number;
  cod_refund_payments: Array<{ amount: number; reference: string; paid_at: string }>;
}
export default function Refunds() {
  const [rows, setRows] = useState<Obligation[]>([]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('cod_refund_obligations')
      .select('id,order_id,amount,cod_refund_payments(amount,reference,paid_at)')
      .order('created_at', { ascending: false })
      .limit(100);
    setError(error ? 'Could not load refund balances.' : '');
    if (!error) setRows(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.rpc('record_cod_refund', {
        p_obligation_id: selected,
        p_amount: Number(amount),
        p_reference: reference,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setReference('');
      setAmount('');
      setSelected('');
      await load();
    } catch {
      setError('Could not record repayment. Retry using the same receipt reference.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-4">COD refunds</h1>
      <p className="mb-4">
        Record money already repaid to a customer. This page does not transfer funds. Keep the
        receipt reference for reconciliation.
      </p>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button className="underline mb-4" onClick={() => void load()}>
        Refresh
      </button>
      <ul>
        {rows.map(row => {
          const paid = row.cod_refund_payments.reduce((sum, p) => sum + p.amount, 0);
          return (
            <li key={row.id} className="border p-3 mb-2">
              <p>
                Order {row.order_id} — Due {formatEGP(row.amount)} · Repaid {formatEGP(paid)} ·
                Outstanding {formatEGP(row.amount - paid)}
              </p>
              <ul>
                {row.cod_refund_payments.map(p => (
                  <li key={p.reference}>
                    {p.reference} · {formatEGP(p.amount)} ·{' '}
                    {new Date(p.paid_at).toLocaleDateString()}
                  </li>
                ))}
              </ul>
              {paid < row.amount && (
                <button
                  className="underline"
                  onClick={() => {
                    setSelected(row.id);
                    setAmount(String(row.amount - paid));
                  }}
                >
                  Record repayment
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {selected && (
        <form onSubmit={record} className="space-y-3 mt-4">
          <label className="block">
            Amount in EGP
            <input
              className="border ml-2 p-2"
              type="number"
              min={1}
              step={1}
              required
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </label>
          <label className="block">
            Receipt reference
            <input
              className="border ml-2 p-2"
              minLength={3}
              maxLength={200}
              required
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </label>
          <button className="bg-navy text-white p-2" disabled={busy}>
            Save repayment record
          </button>
        </form>
      )}
    </AdminLayout>
  );
}
