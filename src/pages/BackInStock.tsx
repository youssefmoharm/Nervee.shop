import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSEO } from '../lib/seo';
import { backInStockService } from '../services/backInStockService';
import { Loader2 } from 'lucide-react';

export function BackInStock() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [product, setProduct] = useState<{
    name: string;
    id: string;
    price: number;
    category: string;
    image?: string;
  } | null>(null);

  useSEO({
    title: 'Back in Stock Notification | NERVE',
    description: 'Get notified when this product is back in stock.',
  });

  useEffect(() => {
    if (productId) {
      fetchProduct(productId);
    }
  }, [productId]);

  const fetchProduct = async (id: string) => {
    try {
      const response = await fetch(`/api/products/${id}`);
      const data = await response.json();
      setProduct(data);
    } catch (err) {
      // Fallback - we'll show generic product info
      setProduct({ name: 'This Product', id, price: 0, category: '', image: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address.', 'error', 3000);
      return;
    }

    if (!productId) {
      showToast('Please select a product first.', 'error', 3000);
      return;
    }

    setStatus('loading');

    try {
      const result = await backInStockService.request(productId, 'M', email);

      if (result.error) {
        setStatus('error');
        showToast(result.error, 'error', 3000);
        return;
      }

      setStatus('success');
      showToast('We will notify you when this product is back in stock.', 'success', 3000);
      setEmail('');
    } catch (err) {
      setStatus('error');
      showToast('Please try again later.', 'error', 3000);
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="nv-heading text-5xl mb-8">You&apos;re on the list!</h1>
          <p className="text-xl mb-8">
            We&apos;ll notify you as soon as this product is back in stock.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-8">Notify Me When Back in Stock</h1>

        {product && (
          <div className="mb-8 p-4 border border-navy/20 rounded-lg text-center">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-64 object-cover rounded-lg mb-4"
            />
            <h2 className="text-2xl font-semibold mb-2">{product.name}</h2>
            <p className="text-navy/60">
              {product.price / 100} EGP • {product.category}
            </p>
          </div>
        )}

        <p className="text-navy/70 mb-8">
          Enter your email below and we&apos;ll notify you as soon as this product is available
          again.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs font-medium text-navy/60 mb-1.5 block">Email Address</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy"
              />
            </label>
          </div>

          {status === 'error' && (
            <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
            Notify Me
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-navy/10 text-center">
          <p className="text-sm text-navy/60">No spam, unsubscribe anytime.</p>
        </div>
      </div>
    </div>
  );
}
