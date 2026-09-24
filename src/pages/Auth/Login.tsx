import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSEO } from '../../hooks/useSEO';
import { useI18n } from '../../lib/i18n';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useSEO({
    title: 'Sign In — NERVE',
    description: 'Sign in to your NERVE account to track orders, save addresses, and more.',
    robots: 'noindex, nofollow',
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        return;
      }
      navigate(location.state?.from ?? '/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white text-navy min-h-screen pt-32 pb-24 px-5 md:px-8">
      <div className="mx-auto max-w-md">
        <h1 className="nv-heading text-5xl mb-2">{t('Sign In')}</h1>
        <p className="text-navy/60 mb-8">{t('Welcome back to NERVE.')}</p>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Email')}</span>
            <input
              type="email"
              required
              data-testid="login-email-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-navy/60 mb-1.5 block">{t('Password')}</span>
            <input
              type="password"
              required
              data-testid="login-password-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-navy/20 px-4 py-3 text-sm focus:outline-none focus:border-navy transition-colors"
            />
          </label>

          {error && <p className="text-xs text-red-600">{t(error)}</p>}

          <button
            type="submit"
            data-testid="login-button"
            disabled={loading}
            className="w-full bg-navy text-white nv-eyebrow py-4 hover:bg-navy-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : t('Sign In')}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-navy/60 hover:text-navy underline">
            {t('Forgot password?')}
          </Link>
          <Link to="/register" className="text-navy/60 hover:text-navy underline">
            {t('Create an account')}
          </Link>
        </div>
      </div>
    </div>
  );
}
