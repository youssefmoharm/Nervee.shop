import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { returnEligibility } from '../lib/returnEligibility';
interface Item {
  id: string;
  product_name: string;
  size: string;
  quantity: number;
  returned_quantity?: number;
}
export default function GuestReturnForm({
  order,
  token,
}: {
  order: {
    order_number: string;
    email: string;
    status?: string;
    created_at: string;
    delivered_at?: string;
    placed_at?: string;
    items?: Item[];
  };
  token: string;
}) {
  const eligible = returnEligibility({ ...order, status: order.status ?? 'placed' });
  const [type, setType] = useState('return');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState<
    Record<string, { quantity: number; replacementSize: string }>
  >({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (
    !token ||
    !order.items ||
    (!eligible.canReturn && !eligible.canExchange && !eligible.canCancel)
  )
    return null;
  const requestType = eligible.canReturn
    ? type
    : eligible.canExchange
    ? 'exchange'
    : 'cancellation';
  return (
    <form
      className="border rounded p-5 mt-6 space-y-3"
      onSubmit={async e => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage('');
        try {
          const { error } = await supabase.functions.invoke('request-return', {
            body: {
              email: order.email,
              orderNumber: order.order_number,
              token,
              type: requestType,
              reason,
              items: Object.entries(selected)
                .filter(([, v]) => v.quantity > 0)
                .map(([orderItemId, v]) => ({ orderItemId, ...v })),
            },
          });
          if (error) {
            let text = 'Could not submit your request. Please try again.';
            if (error instanceof FunctionsHttpError) {
              const body = await error.context.json();
              if (typeof body.error === 'string') text = body.error;
            }
            throw new Error(text);
          }
          setMessage('Request submitted. Our team will review it.');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="nv-heading text-xl">Request a return, exchange or cancellation</h2>
      <label className="block">
        Request type
        <select
          className="border p-2 ml-2"
          value={requestType}
          onChange={e => setType(e.target.value)}
        >
          {eligible.canReturn && <option value="return">Return for refund</option>}
          {eligible.canExchange && <option value="exchange">Size exchange</option>}
          {eligible.canCancel && <option value="cancellation">Cancellation</option>}
        </select>
      </label>
      {requestType !== 'cancellation' &&
        order.items.map(item => (
          <div key={item.id} className="border p-2">
            <label>
              {item.product_name} ({item.size}) — Quantity
              <input
                className="border w-16 ml-2"
                type="number"
                min={0}
                max={item.quantity - (item.returned_quantity ?? 0)}
                value={selected[item.id]?.quantity ?? 0}
                onChange={e =>
                  setSelected(prev => ({
                    ...prev,
                    [item.id]: {
                      quantity: Number(e.target.value),
                      replacementSize: prev[item.id]?.replacementSize ?? '',
                    },
                  }))
                }
              />
            </label>
            {requestType === 'exchange' && (
              <label className="block">
                Replacement size
                <select
                  className="border ml-2"
                  value={selected[item.id]?.replacementSize ?? ''}
                  onChange={e =>
                    setSelected(prev => ({
                      ...prev,
                      [item.id]: {
                        quantity: prev[item.id]?.quantity ?? 0,
                        replacementSize: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Choose size</option>
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL']
                    .filter(s => s !== item.size)
                    .map(s => (
                      <option key={s}>{s}</option>
                    ))}
                </select>
              </label>
            )}
          </div>
        ))}
      <label className="block">
        Reason
        <textarea
          className="border block w-full p-2"
          required
          minLength={10}
          maxLength={1000}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
      </label>
      <button className="bg-navy text-white p-2" disabled={busy}>
        Submit request
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
