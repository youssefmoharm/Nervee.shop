import { useState, type FormEvent } from 'react';
import { newsletterService } from '../services/newsletterService';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'loading' | 'success'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const { error } = await newsletterService.subscribe(email);
    setStatus(error ? 'error' : 'success');
  };

  return (
    <section className="bg-navy py-20 md:py-28 px-5 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="nv-heading text-4xl md:text-6xl">Stay in the Loop</h2>
        <p className="text-silver mt-4 max-w-md mx-auto">
          Get early access to new drops, exclusive releases, and special offers.
        </p>

        {status === 'success' ? (
          <p className="mt-8 nv-eyebrow text-white">You&apos;re on the list. Welcome to NERVE.</p>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              data-testid="newsletter-email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              placeholder="Enter your email"
              className="bg-transparent border border-white/30 px-5 py-3.5 text-sm w-full sm:w-80 focus:outline-none focus:border-white transition-colors placeholder:text-silver/60"
            />
            <button
              type="submit"
              data-testid="newsletter-subscribe"
              disabled={status === 'loading'}
              className="bg-white text-navy text-xs font-semibold tracking-widest2 uppercase px-8 py-3.5 hover:bg-mist transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Joining…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="mt-3 text-xs text-red-300">Enter a valid email to join the list.</p>
        )}
      </div>
    </section>
  );
}
