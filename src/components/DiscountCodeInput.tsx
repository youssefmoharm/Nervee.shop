import { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { discountService } from '../services/discountService';
import { Trash2 } from 'lucide-react';

interface DiscountCodeInputProps {
  subtotal: number;
  onApply: (discount: { code: string; discountAmount: number; finalAmount: number }) => void;
  onRemove: () => void;
  appliedCode?: string | null;
}

export function DiscountCodeInput({
  subtotal,
  onApply,
  onRemove,
  appliedCode,
}: DiscountCodeInputProps) {
  const { showToast } = useToast();
  const [code, setCode] = useState(appliedCode || '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleApply = async () => {
    if (!code.trim()) {
      showToast('Please enter a discount code', 'error', 3000);
      return;
    }

    setStatus('loading');
    const result = await discountService.validate(code.trim(), subtotal);

    if (!result.valid || !result.discount) {
      setStatus('error');
      showToast(result.error || 'Please check your code and try again', 'error', 3000);
      return;
    }

    const { discountAmount, finalAmount } = discountService.calculateFinalAmount(
      result.discount,
      subtotal,
    );

    setStatus('success');
    showToast(`You saved ${discountAmount / 100} EGP`, 'success', 3000);

    onApply({
      code: result.discount.code,
      discountAmount,
      finalAmount,
    });
  };

  const handleRemove = () => {
    setCode('');
    setStatus('idle');
    onRemove();
    showToast('Order total has been updated', 'success', 3000);
  };

  if (appliedCode) {
    return (
      <div className="bg-navy/5 rounded-lg p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Discount Applied</p>
          <p className="text-sm text-navy/70">Code: {appliedCode}</p>
        </div>
        <button
          onClick={handleRemove}
          className="text-navy/60 hover:text-red-600 transition-colors"
          aria-label="Remove discount"
        >
          <Trash2 size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-navy mb-3">Have a discount code?</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="ENTER CODE"
          className="flex-1 border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
        />
        <button
          onClick={handleApply}
          disabled={status === 'loading'}
          className="bg-navy text-white nv-eyebrow px-6 py-3 hover:bg-navy-2 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {status === 'loading' ? 'Checking...' : 'Apply'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-600 mt-2">Invalid code. Please check and try again.</p>
      )}
    </div>
  );
}
