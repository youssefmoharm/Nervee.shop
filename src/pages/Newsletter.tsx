import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSEO } from '../lib/seo';
import { newsletterService } from '../services/newsletterService';

export function Newsletter() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useSEO({
    title: 'Subscribe to Our Newsletter | NERVE',
    description:
      'Subscribe to NERVE newsletter for the latest drops, exclusive offers, and fashion inspiration.',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      showToast('Please enter a valid email address.', 'error', 3000);
      return;
    }

    setStatus('loading');
    const { error } = await newsletterService.subscribe(email);

    if (error) {
      setStatus('error');
      showToast('Something went wrong. Please try again.', 'error', 3000);
      return;
    }

    setStatus('success');
    showToast(
      'Welcome to the NERVE family. Watch your inbox for exclusive offers.',
      'success',
      3000,
    );
    setEmail('');
  };

  if (status === 'success') {
    return (
      <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="nv-heading text-5xl mb-8">Welcome to NERVE!</h1>
          <p className="text-xl mb-8">
            Thank you for subscribing to our newsletter. You&apos;ll receive exclusive offers and
            the latest drops directly to your inbox.
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
      <div className="mx-auto max-w-2xl">
        <h1 className="nv-heading text-5xl mb-8">Join Our Newsletter</h1>
        <p className="text-navy/70 leading-relaxed mb-8">
          Subscribe to receive exclusive offers, early access to new drops, and fashion inspiration
          from NERVE.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
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

          {status === 'error' && (
            <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full bg-navy text-white nv-eyebrow px-8 py-3.5 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {status === 'loading' && (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            Subscribe Now
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-navy/10">
          <p className="text-sm text-navy/60 mb-4">Why subscribe?</p>
          <ul className="space-y-2 text-sm text-navy/80">
            <li>• Exclusive offers and discounts</li>
            <li>• Early access to new collections</li>
            <li>• Fashion inspiration and styling tips</li>
            <li>• No spam, unsubscribe anytime</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
